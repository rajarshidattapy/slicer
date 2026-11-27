import asyncio
import datetime
import logging
from sqlalchemy import select, delete, desc
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from api.config import settings
from db.schema import Alert, AlertNotification, Base, Product, PriceSnapshot, SearchRecord

logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
_write_lock = asyncio.Lock()


async def init_database() -> None:
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        logger.error("Database initialization failed: %s", exc)


async def save_search_record(query: str, pin: str, results_json: str) -> None:
    async with _write_lock:
        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    record = SearchRecord(query=query, pin=pin, results_json=results_json)
                    session.add(record)
        except Exception as exc:
            logger.error("Failed to save search record: %s", exc)


async def save_product_and_snapshot(
    normalized_name: str,
    platform: str,
    name: str,
    price: float,
    pin: str,
    quantity: str | None = None,
    brand: str | None = None,
    image_url: str | None = None,
    product_url: str | None = None,
    mrp: float | None = None,
    in_stock: bool = True,
    logged_in: bool = False,
) -> None:
    async with _write_lock:
        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    stmt = select(Product).where(
                        Product.platform == platform,
                        Product.name == name,
                    )
                    result = await session.execute(stmt)
                    product = result.scalars().first()

                    if not product:
                        product = Product(
                            normalized_name=normalized_name,
                            platform=platform,
                            name=name,
                            quantity=quantity,
                            brand=brand,
                            image_url=image_url,
                            product_url=product_url,
                            in_stock=in_stock,
                        )
                        session.add(product)
                        await session.flush()
                    else:
                        product.normalized_name = normalized_name
                        if quantity is not None:
                            product.quantity = quantity
                        if brand is not None:
                            product.brand = brand
                        if image_url is not None:
                            product.image_url = image_url
                        if product_url is not None:
                            product.product_url = product_url
                        product.in_stock = in_stock
                        product.updated_at = datetime.datetime.now(datetime.timezone.utc)

                    snapshot = PriceSnapshot(
                        product_id=product.id,
                        price=price,
                        mrp=mrp,
                        in_stock=in_stock,
                        pin=pin,
                        logged_in=logged_in,
                    )
                    session.add(snapshot)
        except Exception as exc:
            logger.error("Failed to save product snapshot: %s", exc)


async def get_price_history_by_normalized_name(normalized_name: str, limit: int = 100) -> list[dict]:
    try:
        async with AsyncSessionLocal() as session:
            stmt = (
                select(PriceSnapshot, Product)
                .join(Product, PriceSnapshot.product_id == Product.id)
                .where(Product.normalized_name == normalized_name)
                .order_by(desc(PriceSnapshot.scraped_at))
                .limit(limit)
            )
            result = await session.execute(stmt)
            rows = result.all()

            history: list[dict] = []
            for snapshot, product in rows:
                history.append(
                    {
                        "scraped_at": snapshot.scraped_at.isoformat(),
                        "platform": product.platform,
                        "product_name": product.name,
                        "price": snapshot.price,
                        "mrp": snapshot.mrp,
                        "in_stock": snapshot.in_stock,
                        "pin": snapshot.pin,
                        "logged_in": snapshot.logged_in,
                    }
                )
            return history
    except Exception as exc:
        logger.error("Failed to fetch price history: %s", exc)
        return []


async def get_all_tracked_products(limit: int = 100) -> list[dict]:
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(Product).order_by(desc(Product.updated_at)).limit(limit)
            result = await session.execute(stmt)
            products = result.scalars().all()
            return [
                {
                    "id": p.id,
                    "normalized_name": p.normalized_name,
                    "platform": p.platform,
                    "name": p.name,
                    "quantity": p.quantity,
                    "brand": p.brand,
                    "image_url": p.image_url,
                    "product_url": p.product_url,
                    "in_stock": p.in_stock,
                    "updated_at": p.updated_at.isoformat(),
                }
                for p in products
            ]
    except Exception as exc:
        logger.error("Failed to fetch tracked products: %s", exc)
        return []


async def create_alert(product_query: str, target_price: float, pin: str, platform: str | None = None) -> Alert | None:
    async with _write_lock:
        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    alert = Alert(
                        product_query=product_query,
                        platform=platform,
                        target_price=target_price,
                        pin=pin,
                        active=True,
                    )
                    session.add(alert)
                    await session.flush()
                    await session.refresh(alert)
                    return alert
        except Exception as exc:
            logger.error("Failed to create alert: %s", exc)
            return None


async def get_alerts(active_only: bool = True) -> list[Alert]:
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(Alert)
            if active_only:
                stmt = stmt.where(Alert.active == True)
            stmt = stmt.order_by(desc(Alert.created_at))
            result = await session.execute(stmt)
            return list(result.scalars().all())
    except Exception as exc:
        logger.error("Failed to list alerts: %s", exc)
        return []


async def delete_alert(alert_id: int) -> bool:
    async with _write_lock:
        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    await session.execute(
                        delete(AlertNotification).where(AlertNotification.alert_id == alert_id)
                    )
                    stmt = delete(Alert).where(Alert.id == alert_id)
                    result = await session.execute(stmt)
                    return result.rowcount > 0
        except Exception as exc:
            logger.error("Failed to delete alert: %s", exc)
            return False


async def update_alert_check_time(alert_id: int) -> None:
    async with _write_lock:
        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    stmt = select(Alert).where(Alert.id == alert_id)
                    result = await session.execute(stmt)
                    alert = result.scalars().first()
                    if alert:
                        alert.last_checked = datetime.datetime.now(datetime.timezone.utc)
        except Exception as exc:
            logger.error("Failed to update alert check time: %s", exc)


async def create_alert_notification(
    alert_id: int, product_name: str, platform: str, price: float
) -> AlertNotification | None:
    """Store one notification per observed store price for an alert."""
    async with _write_lock:
        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    existing = await session.scalar(
                        select(AlertNotification).where(
                            AlertNotification.alert_id == alert_id,
                            AlertNotification.platform == platform,
                            AlertNotification.price == price,
                        )
                    )
                    if existing:
                        return None
                    notification = AlertNotification(
                        alert_id=alert_id,
                        product_name=product_name,
                        platform=platform,
                        price=price,
                    )
                    session.add(notification)
                    await session.flush()
                    await session.refresh(notification)
                    return notification
        except Exception as exc:
            logger.error("Failed to create alert notification: %s", exc)
            return None


async def get_alert_notifications(limit: int = 50) -> list[dict]:
    try:
        async with AsyncSessionLocal() as session:
            stmt = (
                select(AlertNotification, Alert)
                .join(Alert, AlertNotification.alert_id == Alert.id)
                .order_by(desc(AlertNotification.created_at))
                .limit(limit)
            )
            rows = (await session.execute(stmt)).all()
            return [
                {
                    "id": notification.id,
                    "alert_id": alert.id,
                    "product_name": notification.product_name,
                    "platform": notification.platform,
                    "price": notification.price,
                    "target_price": alert.target_price,
                    "pin": alert.pin,
                    "created_at": notification.created_at.isoformat(),
                }
                for notification, alert in rows
            ]
    except Exception as exc:
        logger.error("Failed to list alert notifications: %s", exc)
        return []
