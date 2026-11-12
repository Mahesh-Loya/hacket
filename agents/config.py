"""One place for network names and ids used by the agents."""

NETWORK = "testnet"
OWNER = "hackket.testnet"
CONTRACT_ID = "market.hackket.testnet"
PERSONA_NAMES = ["screener", "mechanist", "builder", "hype", "contrarian"]

NEARHUNT_API = "https://nearhunt.xyz/api/projects"
NEARHUNT_WRITER = "nearhunt.near"
USER_AGENT = "hackathon-market (+https://github.com/Mahesh-Loya/hacket)"

TRACKS = ["defi", "thesis", "privacy", "business", "swarms", "security", "agents",
          "realworld", "games", "nfts", "memecoins", "social", "open"]

# Agents never pick our own entry. Fill in our submission id once it exists.
OWN_PROJECT_IDS: set[str] = set()
OWN_PROJECT_NAME = "The Hackathon Market"
