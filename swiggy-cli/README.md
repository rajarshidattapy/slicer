# swiggy-cli

A terminal interface for Swiggy that drives the real website in your running,
logged-in default Google Chrome profile. It does not replay undocumented private
APIs, extract authentication tokens, or submit an order/payment automatically.

## Install

Requires Node.js 22+ and Google Chrome 144 or newer.

```powershell
cd swiggy-cli
npm install
npm link
swiggy setup
```

During setup, the CLI opens `chrome://inspect/#remote-debugging` in your existing
default Chrome profile. Enable remote debugging, return to the terminal, and
approve Chrome's connection prompt. The CLI then operates the same logged-in
profile. It never reads or copies Chrome's cookie database. Chrome requires this
explicit consent before a tool can connect to the default profile.

## Commands

```powershell
# Set or change delivery location
swiggy location "Indiranagar, Bengaluru"

# Search and print dishes in the terminal
swiggy search pizza
swiggy search biryani --limit 20 --json

# Add an item. Customisable items finish interactively in Chrome.
swiggy add pizza --item "Margherita" --restaurant "Pizza Hut"

# Review the cart and finish checkout yourself in Chrome
swiggy cart

# Open any Swiggy page in your default Chrome profile
swiggy open https://www.swiggy.com/search?query=dosa
```

Swiggy currently challenges direct/headless HTTP access, so commands connect to
your visible Chrome after browser approval. The connection is restricted to
`swiggy.com` and Swiggy's media host. Website markup and behavior can change;
selectors are based on the observed November 2026 web app and favor
accessibility/test attributes over generated CSS class names.

## Safety and limitations

- Login, OTPs, addresses, checkout, and payment stay inside Swiggy.
- Chrome displays and requires approval for the debugging connection.
- `checkout` never clicks **Place Order** or submits payment.
- `add` changes the active Swiggy cart. Customisation is left to the user.
- This is an independent, unofficial client and is not affiliated with Swiggy.
- Use it in accordance with Swiggy's terms and applicable laws.

## Development

```powershell
npm test
npm run check
```

### Observed web behavior

Browser observation on 2026-11-27 found the following current flows:

- location suggestions: `POST /dapi/misc/place-autocomplete`
- selected-place resolution: `POST /dapi/misc/address-recommend`
- search: `GET /dapi/restaurants/search/v3`
- cart read: `GET /dapi/cart`

The CLI intentionally uses those observations to understand the flow but does
not call these private endpoints directly. Authenticated checkout behavior
remains outside the automated evidence boundary.
