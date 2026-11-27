# zomato-cli

One terminal selector for three Eternal consumer services:

- Zomato Delivery - `https://www.zomato.com/<location>/delivery`
- District - `https://www.district.in/`
- Blinkit - `https://blinkit.com/`

The default action opens the selected service normally in your existing Chrome,
preserving its login and location without attaching a debugger. An explicit
`--list` action launches a disposable, unsigned public session and prints visible
cards; it does not log in, add to carts, book, order, or pay.

## Install

```powershell
cd C:\Users\asus\Desktop\slicer\zomato-cli
npm install
npm link
zomato
```

Running `zomato` with no arguments presents an interactive selector for Zomato
Delivery, District, and Blinkit.

## Examples

```powershell
# Open normally in default Chrome
zomato delivery --location bangalore
zomato delivery --location bangalore --search pizza
zomato district --section movies
zomato blinkit --search butter

# Print public cards in the terminal
zomato delivery --location bangalore --list --limit 10
zomato district --section dining --list --limit 10
zomato blinkit --search butter --list --limit 10

# Machine-readable output
zomato blinkit --search milk --list --json
```

District sections are `for-you`, `dining`, `movies`, `events`, `stores`,
`activities`, and `play`.

## Evidence boundary and limitations

The routes and public-card parsers were observed on 2026-11-27 using one fresh,
unsigned Chrome context per service. Observed same-origin calls included Zomato
`/webroutes/auth/init`, District `/gw/web/pre-home`, and Blinkit `/feed/` plus
configuration/layout endpoints. The CLI does not replay those private APIs.

Web markup, availability, location, prices, and offers can change. `--list`
results reflect only the visible public page at capture time and may trigger a
site challenge if used repeatedly. Stop and use normal `open` mode if a service
presents a challenge.

This is an independent, unofficial tool and is not affiliated with Zomato,
District, Blinkit, or Eternal. Use it in accordance with each service's terms.
