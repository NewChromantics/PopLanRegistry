PopLanRegistry
=======================
- This is a very basic server for listing local addresses temporarily for an IP (we're assuming the lan has a single outgoing ip)
- The goal is to give a client with no broadcast capabilities (ie. browser websocket) the ability to "find" devices on their lan.
- A device report's it's local endpoints which register with the external ip
- Another device asks for a list, which are given back if any match the requester's external ip

Register address
-------------------------
`GET /register?address=myipad.local:8080`

Fetch adresses
--------------------------
`GET /list`
to return JSON