---
title: ✈️ Travel-Packing Checklist
location: <%- prompt('location','Where are we going?') %>
leaving: <%- prompt('leaving',"When are we leaving? (YYYY-MM-DD)") %>
returning: <%- prompt('returning','When are we returning? (YYYY-MM-DD)') %>
days: <%- date.daysBetween(`${leaving}`,`${returning}`) %>
folder: Travel
---
🌤Weather:
<% const lookup = await DataStore.invokePluginCommandByName("Get weather XCallbackURL","np.WeatherLookup",[`${location}`]) -%>
<%- lookup %>

**🛂 Before**
*  [USPS Mail Hold](https://reg.usps.com/entreg/LoginAction_input?app=ATG&appURL=https%3A%2F%2Fstore.usps.com%2Fholdmail%2F)
* Arrange for pet boarding
* Online Flight Check-in (24h before)
* Download Spotify Offline
* Download Audiobooks

## **📄 Documents**
* Boarding pass
* Passport / ID Cards
* Drivers license
* Insurance card
* Credit cards
* Hotel reservation
* Rental car reservation

## **💼 Packing**
* theragun
* Underwear (bra/booty short)
* Socks
* Bathing suits
* Swim shirts
* T shirts and shirts
* Shorts 
* Work out clothes
* Jeans/ pants
* Nice-ish outfits / Shirt
* Pajamas
* Belt
* Sweat jacket
* Jacket for night time
* in winter: heavy sweaters, pants, thick socks, boots, beanie, gloves. 
* Baseball cap
* Flip flops and/or sandals for pool
* Tennis shoes
* Nice shoes
* Toiletries, etc.: [Check to see if Mom will bring basic toiletries]; YOU bring any personal extras 
* Medications!, Eczema creams, Nasal Spray, Acne Meds, hair gels etc., Make up, tylenol
* Small bottle shampoo
* Masks (bring extras) 
* Contact lenses
* Retainers/rubber bands etc 
* Sunscreen
* Vitamins 
* Hair ties
* Jewelry
* Pierce: Stretch bands, stretch mat, athletic tape, moleskin, bandaids, foam roller 

## ⚠️ Important Stuff:
* Niki: Baby and Doo doo and journal
* Apple Watch 
* Distance Glasses
* Sunglasses
* Backpack or bag to take to pool/tennis
* Homework
* Phone charger
* Phone Headphones
* Books to read
* Computer/iPad + Computer Charger 
* Computer headphones

## ⁉️ Maybe Stuff:
* BOAT KEY? (main one is in tesla, extra is in bev car)
* Palm Desert: refrigerated food bags and 2 ice packs
* Palm Desert: Tesla Charger cable
* Dump//refill kitty litter?
* Set up kitty cam
* Tennis bag
* protein bars
* Nightlight
* [x] Umbrella?
* Eye mask for overnight flight
* Airplane neck pillow
* Water bottle
* David: blue arrowhead backpack
* Playing cards, Uno, books, mad Libs, colored pencils and the drawing  book
* Scooters
* Shabbos candles  
* Arrowhead: Ski stuff, towels, etc
* Water bottle?

## 😺 If Bringing Pets:
* Food, bowls, leashes, poop bags
* Litter box, litter, cage?
