"""
veclib.py - shared library for the Milvus Vector Explorer actions.

Contents:
- Local deterministic embedding model ("local-concept-hybrid-v1"): a curated
  semantic concept lexicon combined with signed feature hashing over words,
  stems, bigrams and character n-grams, L2-normalized to 512 dimensions.
  No external embedding service is reachable from the action runtime, so the
  model is implemented in code and is identical for documents and queries.
- Milvus collection schema + idempotent ensure helpers.
- PCA projection of stored embeddings (numpy) for the 2D vector space.
- Cosine similarity and keyword ranking for the semantic-vs-keyword compare.
- OpenServerless web-action request helpers.
"""

import hashlib
import json
import math
import re
import time

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

COLLECTION = "vector_explorer_documents"
VECTOR_FIELD = "embedding"
INDEX_NAME = "embedding"
EMBED_DIM = 512
METRIC_TYPE = "COSINE"
INDEX_TYPE = "HNSW"
INDEX_BUILD_PARAMS = {"M": 16, "efConstruction": 200}
SEARCH_EF = 96

EMBED_MODEL = {
    "name": "local-concept-hybrid-v1",
    "provider": "in-code deterministic model",
    "dim": EMBED_DIM,
    "description": (
        "Concept-expansion lexicon + signed feature hashing over words, "
        "stems, bigrams and character n-grams, L2-normalized. The same model "
        "embeds documents and queries, so dimensions always match."
    ),
}

CATEGORIES = [
    "Technology",
    "Science",
    "Astronomy",
    "Artificial Intelligence",
    "Music",
    "Nature",
]

# ---------------------------------------------------------------------------
# Tokenization
# ---------------------------------------------------------------------------

WORD_RE = re.compile(r"[a-z0-9]+")

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "else", "when",
    "of", "in", "on", "at", "to", "for", "from", "by", "with", "without",
    "about", "into", "over", "under", "up", "down", "out", "off", "as",
    "is", "are", "was", "were", "be", "been", "being", "am", "do", "does",
    "did", "done", "have", "has", "had", "can", "could", "will", "would",
    "shall", "should", "may", "might", "must", "get", "got", "make", "made",
    "how", "what", "why", "which", "who", "whom", "whose", "where", "that",
    "this", "these", "those", "there", "here", "it", "its", "they", "them",
    "their", "we", "our", "you", "your", "i", "me", "my", "he", "she", "his",
    "her", "him", "us", "not", "no", "nor", "so", "too", "very", "just",
    "also", "than", "some", "any", "all", "both", "each", "few", "more",
    "most", "other", "such", "own", "same", "s", "t", "don", "now", "like",
}


def stem(word):
    """Light suffix stripper so 'learning/learned/learns' share features."""
    if word.endswith("ies") and len(word) - 3 >= 4:
        return word[:-3] + "y"
    for suffix in ("ations", "ation", "ings", "ing", "ies", "ied",
                   "ers", "er", "ed", "es", "ly", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 4:
            return word[: len(word) - len(suffix)]
    return word


def tokens_of(text):
    return [t for t in WORD_RE.findall((text or "").lower()) if len(t) >= 2]


def stems_of(text):
    return [stem(t) for t in tokens_of(text)]


# ---------------------------------------------------------------------------
# Semantic concept lexicon (base-form words; matched through stems)
# ---------------------------------------------------------------------------

CONCEPT_WORDS = {
    # --- technology ---
    "compute": ("computer", "computing", "computation", "calculator",
               "processor", "cpu", "gpu", "chip", "silicon", "hardware",
               "server", "cloud", "supercomputer", "ibm", "google",
               "workstation", "screen", "engine", "execute", "boot",
               "sandbox", "pipeline", "operating"),
    "quantum": ("quantum", "qubit", "qubits", "superposition", "entangled",
                "entanglement", "coherence", "decoherence"),
    "storage": ("storage", "store", "stores", "storing", "memory", "disk",
                "disks", "ssd", "drive", "drives", "platter", "flash", "nand",
                "byte", "bytes", "bit", "bits", "file", "files", "archive",
                "database"),
    "network": ("network", "networks", "internet", "wireless", "wifi",
                "bluetooth", "antenna", "antennas", "signal", "signals",
                "bandwidth", "latency", "spectrum", "radio", "satellite",
                "connect", "connected", "connecting", "online", "packet",
                "protocol", "streaming", "stream", "download", "upload",
                "remote", "communicate", "millimeter"),
    "web": ("web", "browser", "browsers", "html", "javascript", "css",
            "page", "pages", "website", "render", "renders", "rendering",
            "frontend", "backend", "http", "link", "links", "parse",
            "parsing", "chromium", "firefox", "app"),
    "phone": ("phone", "phones", "smartphone", "mobile", "device", "tablet",
              "touchscreen"),
    "energy": ("battery", "batteries", "power", "powers", "powered",
               "energy", "electricity", "electric", "charge", "charging",
               "rechargeable", "volt", "voltage", "grid", "renewable",
               "solar", "turbine", "generator", "fuel", "lithium", "anode",
               "cathode", "electrolyte", "ion"),
    "robotics": ("robot", "robots", "robotic", "robotics", "automation",
                 "autonomous", "drone", "drones", "rover", "rovers", "steer",
                 "android"),
    "transport": ("car", "cars", "vehicle", "vehicles", "engine", "motor",
                  "wheel", "wheels", "drive", "driving", "flight", "plane",
                  "aviation"),
    # --- science ---
    "genetics": ("gene", "genes", "genetic", "genetics", "genome", "dna",
                 "rna", "helix", "nucleotide", "chromosome", "heredity",
                 "mutation", "trait", "traits", "crispr", "cas9",
                 "sequence", "sequencing", "biotech", "biotechnology",
                 "forensic", "inherited", "inherit", "deoxyribonucleic",
                 "base", "blueprint", "organism", "organisms"),
    "immune": ("immune", "immunity", "immunization", "vaccine", "vaccines",
               "antibody", "antibodies", "antigen", "pathogen", "virus",
               "viruses", "bacteria", "infection", "infections", "disease",
               "diseases", "illness", "medicine", "medical", "drug", "drugs",
               "therapy", "treatment", "hospital", "doctor", "patient",
               "health", "symptom", "epidemic", "pandemic", "antibiotic",
               "microbe", "microbial", "cancer", "tumor", "tumors", "scan",
               "scans", "mri", "surgery", "surgeon", "cell", "cells",
               "memory"),
    "geology": ("earthquake", "earthquakes", "volcano", "volcanic",
                "tectonic", "tectonics", "crust", "mantle", "mineral",
                "minerals", "rock", "rocks", "mountain", "mountains",
                "erosion", "sediment", "continental", "drift", "drifting",
                "plate", "plates", "basin", "limestone", "core"),
    "physics": ("physics", "physical", "force", "forces", "gravity",
                "mass", "particle", "particles", "electron", "electrons",
                "proton", "neutron", "wave", "waves", "frequency",
                "frequencies", "superconduct", "superconducting",
                "superconductivity", "resistance", "magnet", "magnets",
                "magnetic", "field", "fields", "radiation", "nuclear",
                "fusion", "fission", "temperature", "relativity",
                "einstein", "newton", "ripple", "conduct", "accelerator",
                "spin", "spinning"),
    "chemistry": ("chemistry", "chemical", "reaction", "reactions",
                  "compound", "compounds", "atom", "atoms", "atomic",
                  "molecule", "molecules", "molecular", "enzyme", "enzymes",
                  "protein", "proteins", "acid", "bond", "bonds", "carbon",
                  "sugar", "sugars", "nutrient", "nutrients", "dioxide",
                  "oxygen"),
    "math": ("math", "mathematics", "mathematical", "number", "numbers",
             "equation", "equations", "formula", "formulas", "theorem",
             "proof", "proofs", "statistic", "statistics", "probability",
             "geometry", "algebra", "calculus", "ratio", "ratios",
             "exponential", "exponentially", "calculation", "calculations",
             "pattern", "patterns", "minimize", "function", "functions",
             "cone"),
    "research": ("science", "scientific", "scientist", "scientists",
                 "research", "researchers", "study", "studies", "experiment",
                 "experiments", "discovery", "discoveries", "laboratory",
                 "lab", "theory", "theories", "evidence", "hypothesis",
                 "invention", "inventor"),
    # --- astronomy ---
    "space": ("space", "universe", "cosmic", "cosmos", "galaxy", "galaxies",
              "interstellar", "telescope", "telescopes", "astronomy",
              "astronomer", "astronomers", "astronomical", "orbit", "orbits",
              "orbital", "celestial", "cosmology", "spacetime", "void",
              "expansion", "expanding", "accelerating", "accelerate",
              "recede", "sky", "comet", "comets", "asteroid", "asteroids",
              "meteor", "meteors", "dark", "light", "hawking", "escape",
              "life"),
    "blackhole": ("hole", "holes", "horizon", "singularity", "blackhole",
                  "supermassive", "collapse", "collapsing", "hawking",
                  "escape", "swallow"),
    "star": ("star", "stars", "sun", "solar", "stellar", "supernova",
             "nebula", "nebulae", "hydrogen", "helium", "constellation",
             "dwarf", "dwarfs", "ignite", "ignition", "brightness", "bright",
             "luminous", "giant", "neutron", "core", "fusion"),
    "planet": ("planet", "planets", "earth", "mars", "martian", "venus",
               "jupiter", "saturn", "mercury", "moon", "atmosphere",
               "terrain", "soil", "regolith", "crater", "craters", "curiosity",
               "perseverance"),
    "exoplanet": ("exoplanet", "exoplanets", "extrasolar", "habitable",
                  "wobble", "wobbles", "kepler", "lightyear", "lightyears",
                  "parsec", "alien", "aliens", "extraterrestrial", "world",
                  "worlds"),
    "exploration": ("mission", "missions", "probe", "probes", "spacecraft",
                    "launch", "launches", "nasa", "rocket", "rockets",
                    "lander", "astronaut", "astronauts", "shuttle", "apollo",
                    "curiosity", "perseverance", "rover", "rovers"),
    # --- artificial intelligence ---
    "ai": ("ai", "artificial", "intelligence", "intelligent", "machine",
           "machines", "model", "models", "cognitive", "thinking", "think",
           "smart", "reasoning", "logic", "agent", "agents", "chatbot",
           "chatbots", "assistant", "assistants", "gpt", "understand",
           "understanding", "generative", "consciousness", "predict",
           "prediction", "predictive", "architecture"),
    "ml": ("learning", "learn", "learns", "teach", "training", "train",
           "trained", "algorithm", "algorithms", "optimization", "optimize",
           "gradient", "backpropagation", "dataset", "datasets", "data",
           "label", "labels", "supervised", "unsupervised", "parameter",
           "parameters", "weight", "weights", "epoch", "benchmark", "tuning",
           "generalize", "generalization", "classify", "classification",
           "classify", "error", "minimize", "layer", "layers", "pipeline"),
    "neural": ("neural", "neuron", "neurons", "network", "networks", "brain",
               "deep", "recurrent", "convolution", "convolutional",
               "transformer", "transformers", "attention", "perception",
               "architecture", "layer", "layers"),
    "nlp": ("language", "languages", "text", "word", "words", "sentence",
            "sentences", "token", "tokens", "corpus", "corpora",
            "translation", "translate", "grammar", "linguistics", "speech",
            "chat", "dialogue", "generation", "generate", "generating",
            "prompt", "prompts", "summary", "summarize", "meaning",
            "sequence", "hallucinate", "hallucination", "query", "queries",
            "semantic", "semantics"),
    "vision": ("vision", "image", "images", "visual", "picture", "pictures",
               "photo", "photos", "pixel", "pixels", "camera", "cameras",
               "recognition", "recognize", "recognizes", "detect",
               "detection", "detects", "scene", "object", "objects", "video",
               "videos", "texture", "shape", "shapes", "filter", "filters",
               "classify", "classification", "light", "watch", "watching"),
    "rl": ("reward", "rewards", "reinforce", "reinforcement", "reinforcing",
           "policy", "policies", "trial", "feedback", "episode", "episodes",
           "action", "actions", "game", "games", "exploration", "explore"),
    "vector": ("vector", "vectors", "embedding", "embeddings", "similarity",
               "similar", "nearest", "neighbor", "neighbors", "cosine",
               "index", "indexes", "indexing", "semantic", "semantics",
               "dense", "sparse", "retrieval", "retrieving", "dimensional",
               "dimension", "projection", "pca", "ann", "search", "searching",
               "query", "queries", "recommendation", "recommendations",
               "recommend", "distance", "metric", "ranking", "rank"),
    # --- music ---
    "music": ("music", "musical", "melody", "melodies", "tune", "tunes",
              "song", "songs", "audio", "sound", "sounds", "harmony",
              "harmonies", "note", "notes", "chord", "chords", "scale",
              "scales", "octave", "octaves", "pitch", "pitches", "timbre",
              "tone", "tones", "instrument", "instruments", "orchestra",
              "band", "bands", "symphony", "symphonies", "concert",
              "concerts", "musician", "musicians", "composer", "composers",
              "composition", "violin", "violin", "flute", "guitar", "piano",
              "drum", "drums", "fifth", "listen", "listening", "listener",
              "listeners", "ensemble", "emotion", "emotional", "voice"),
    "rhythm": ("rhythm", "rhythms", "rhythmic", "beat", "beats", "tempo",
               "groove", "syncopation", "swing", "percussion", "meter",
               "pulse", "dance", "dancing", "bpm", "drum", "drums"),
    "production": ("production", "producer", "producers", "studio",
                   "studios", "recording", "recordings", "record", "records",
                   "mix", "mixing", "mixes", "mastering", "master", "track",
                   "tracks", "daw", "synthesizer", "synthesizers", "sampler",
                   "samplers", "plugin", "plugins", "reverb", "equalizer",
                   "bass", "layer", "layers", "engineer", "engineers",
                   "amplification", "amplifier"),
    "voice": ("vocal", "vocals", "singer", "singers", "sing", "singing",
              "opera", "arias", "aria", "choir", "choirs", "breath",
              "breathing", "microphone", "tenor", "soprano", "voice",
              "voices", "chorus", "amplification", "screaming"),
    "acoustics": ("acoustic", "acoustics", "wave", "waves", "resonance",
                  "vibrate", "vibrates", "vibration", "vibrations",
                  "oscillate", "oscillation", "amplitude", "decibel",
                  "loudness", "echo", "frequency", "frequencies", "noise",
                  "loud", "membrane", "string", "strings"),
    # --- nature ---
    "plant": ("plant", "plants", "leaf", "leaves", "chlorophyll",
              "photosynthesis", "root", "roots", "flower", "flowers",
              "pollen", "garden", "gardens", "flora", "blossom", "blossoms",
              "crop", "crops", "sugar", "sugars", "oxygen", "dioxide",
              "nutrient", "nutrients", "grow", "growing", "growth", "green",
              "water"),
    "forest": ("forest", "forests", "jungle", "rainforest", "woodland",
               "tree", "trees", "trunk", "trunks", "bark", "canopy",
               "undergrowth", "pine", "pines", "sapling", "saplings",
               "underground", "wood", "woods"),
    "fungi": ("fungi", "fungal", "fungus", "mushroom", "mushrooms",
              "mycelium", "mycorrhiza", "mycorrhizae", "mycorrhizal",
              "spore", "spores", "yeast", "decompose", "decomposition"),
    "ocean": ("ocean", "oceans", "sea", "seas", "marine", "underwater",
              "coral", "reef", "reefs", "polyp", "polyps", "fish", "fishes",
              "whale", "whales", "dolphin", "dolphins", "shark", "sharks",
              "seawater", "tide", "tides", "coastal", "island", "islands",
              "seafloor", "kelp", "bleach", "bleaching", "river", "rivers",
              "lake", "lakes", "water"),
    "wildlife": ("animal", "animals", "mammal", "mammals", "bird", "birds",
                 "butterfly", "butterflies", "bee", "bees", "insect",
                 "insects", "wildlife", "predator", "predators", "prey",
                 "species", "habitat", "habitats", "ecosystem",
                 "ecosystems", "nest", "nests", "breed", "breeding", "pack",
                 "flock", "flocks", "herd", "wild", "colony", "colonies",
                 "organism", "organisms", "scent", "life", "food"),
    "migration": ("migration", "migrate", "migrates", "migratory", "navigate",
                  "navigation", "navigating", "seasonal", "season", "seasons",
                  "wing", "wings", "kilometer", "kilometers", "journey",
                  "journeys"),
    "fire": ("fire", "fires", "wildfire", "wildfires", "burn", "burns",
             "burning", "flame", "flames", "smoke", "ash", "blaze", "ember",
             "embers", "regeneration", "regenerate", "regrow", "cone",
             "cones", "scorch", "char"),
    "climate": ("climate", "weather", "warming", "greenhouse", "emission",
                "emissions", "drought", "droughts", "flood", "floods",
                "storm", "storms", "rainfall", "rain", "rains", "monsoon",
                "snow", "ice", "overheat", "overheating", "hot", "heat"),
    "evolution": ("evolution", "evolve", "evolving", "darwin", "adaptation",
                  "adaptations", "fossil", "fossils", "ancestor",
                  "ancestors", "extinct", "extinction", "prehistoric",
                  "ancient", "survival", "selection"),
}

# Multi-word phrases mapped to concepts (stems joined with "_").
PHRASE_CONCEPTS = {
    "machine learning": ("ml", "ai"),
    "artificial intelligence": ("ai",),
    "neural network": ("neural", "ai"),
    "neural net": ("neural", "ai"),
    "large language": ("nlp", "ai"),
    "language model": ("nlp", "ai"),
    "vector database": ("vector", "storage"),
    "semantic search": ("vector",),
    "nearest neighbor": ("vector",),
    "nearest-neighbor": ("vector",),
    "black hole": ("blackhole", "space"),
    "event horizon": ("blackhole",),
    "solar system": ("star", "planet"),
    "solar panel": ("energy",),
    "big bang": ("space",),
    "dark energy": ("space",),
    "dark matter": ("space",),
    "milky way": ("space", "star"),
    "white dwarf": ("star",),
    "neutron star": ("star", "space"),
    "red planet": ("planet",),
    "red giant": ("star",),
    "spacex rocket": ("exploration", "transport"),
    "gene editing": ("genetics",),
    "immune system": ("immune",),
    "climate change": ("climate",),
    "food chain": ("wildlife", "plant"),
    "coral reef": ("ocean",),
    "underground network": ("fungi", "forest", "network"),
    "particle accelerator": ("physics",),
    "lithium ion": ("energy",),
    "lithium-ion": ("energy",),
    "solid state": ("storage",),
    "solid-state": ("storage",),
    "quantum computing": ("quantum", "compute"),
    "quantum computer": ("quantum", "compute"),
    "quantum mechanic": ("quantum", "physics"),
    "computer vision": ("vision", "ai"),
    "deep learning": ("ml", "neural"),
    "reinforcement learning": ("rl", "ml"),
    "training data": ("ml",),
    "large model": ("ml", "ai"),
    "operating system": ("compute",),
    "web browser": ("web",),
    "music production": ("production", "music"),
    "sound wave": ("acoustics",),
    "sound waves": ("acoustics",),
    "beats per minute": ("rhythm",),
    "perfect fifth": ("music",),
    "electric vehicle": ("energy", "transport"),
    "electric car": ("energy", "transport"),
    "power grid": ("energy",),
    "natural selection": ("evolution",),
    "black holes": ("blackhole", "space"),
    "space telescope": ("space", "exploration"),
    "carbon dioxide": ("plant", "climate", "chemistry"),
    "greenhouse gas": ("climate", "chemistry"),
    "magnetic field": ("physics",),
    "neural networks": ("neural", "ai"),
    "vector search": ("vector",),
    "embedding vector": ("vector",),
    "vector embedding": ("vector",),
    "5g network": ("network",),
    "millimeter wave": ("network",),
}

# ---------------------------------------------------------------------------
# Embedding model
# ---------------------------------------------------------------------------

CONCEPT_INDEX = {}
for _concept, _words in CONCEPT_WORDS.items():
    for _w in _words:
        CONCEPT_INDEX.setdefault(stem(_w), set()).add(_concept)

PHRASE_INDEX = {}
for _phrase, _concepts in PHRASE_CONCEPTS.items():
    key = "_".join(stem(w) for w in _phrase.split())
    PHRASE_INDEX[key] = _concepts


def _add(feats, key, weight):
    feats[key] = feats.get(key, 0.0) + weight


def concepts_of(text):
    """Concept names activated by a text - used for explainable matches."""
    raw = tokens_of(text)
    if not raw:
        return []
    stems = [stem(t) for t in raw]
    active = set()
    i = 0
    n = len(stems)
    while i < n:
        matched = 0
        for size in (3, 2):
            if i + size <= n:
                key = "_".join(stems[i:i + size])
                if key in PHRASE_INDEX:
                    active.update(PHRASE_INDEX[key])
                    matched = size
                    break
        if matched:
            i += matched
            continue
        s = stems[i]
        if raw[i] not in STOPWORDS:
            active.update(CONCEPT_INDEX.get(s, ()))
        i += 1
    return sorted(active)


def _features(text):
    raw = tokens_of(text)
    stems = [stem(t) for t in raw]
    feats = {}
    n = len(raw)
    i = 0
    while i < n:
        # phrase match first (longest), then single tokens
        matched = 0
        for size in (3, 2):
            if i + size <= n:
                key = "_".join(stems[i:i + size])
                if key in PHRASE_INDEX:
                    for c in PHRASE_INDEX[key]:
                        _add(feats, "concept:" + c, 2.4)
                    matched = size
                    break
        if matched:
            i += matched
            continue
        token = raw[i]
        s = stems[i]
        if token not in STOPWORDS:
            _add(feats, "w:" + token, 1.0)
            if s != token:
                _add(feats, "w:" + s, 0.7)
            for c in CONCEPT_INDEX.get(s, ()):
                _add(feats, "concept:" + c, 1.6)
            base = token[:12]
            grams = [base[j:j + 4] for j in range(max(1, len(base) - 3))]
            for g in grams[:5]:
                _add(feats, "c:" + g, 0.30)
        i += 1
    # adjacent bigram features
    for i in range(n - 1):
        t1, t2 = raw[i], raw[i + 1]
        if t1 in STOPWORDS or t2 in STOPWORDS:
            continue
        _add(feats, "b:" + stems[i] + "_" + stems[i + 1], 0.5)
    return feats


def _bucket(key):
    digest = hashlib.md5(key.encode("utf-8")).digest()
    index = ((digest[0] << 8) | digest[1]) % EMBED_DIM
    sign = 1.0 if digest[2] & 1 else -1.0
    return index, sign


def embed_many(texts):
    """Embed a list of texts into L2-normalized vectors."""
    vectors = []
    for text in texts:
        feats = _features(text or "")
        vec = [0.0] * EMBED_DIM
        for key, weight in feats.items():
            index, sign = _bucket(key)
            vec[index] += sign * weight
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        vectors.append([x / norm for x in vec])
    return vectors


def embed(text):
    return embed_many([text])[0]


# ---------------------------------------------------------------------------
# Milvus helpers
# ---------------------------------------------------------------------------

def escape_filter(value):
    """Escape a string for safe use inside a Milvus filter expression."""
    return str(value or "").replace("\\", "\\\\").replace('"', '\\"')


def load_state(client):
    try:
        ret = client.get_load_state(COLLECTION)
        state = ret.get("state") if isinstance(ret, dict) else ret
        return str(state).rsplit(".", 1)[-1]
    except Exception:  # noqa: BLE001 - load state is informational
        return "Unknown"


def ensure_collection(client):
    """Create the collection if missing and make sure it is loaded.

    Never drops or recreates an existing collection.
    """
    result = {"collection": COLLECTION, "created": False}
    if not client.has_collection(COLLECTION):
        from pymilvus import DataType

        schema = client.create_schema(auto_id=False, enable_dynamic_field=False)
        schema.add_field("doc_id", DataType.VARCHAR, is_primary=True, max_length=64)
        schema.add_field("title", DataType.VARCHAR, max_length=512)
        schema.add_field("category", DataType.VARCHAR, max_length=64)
        schema.add_field("content", DataType.VARCHAR, max_length=4096)
        schema.add_field("concepts", DataType.VARCHAR, max_length=1024)
        schema.add_field("created_at", DataType.INT64)
        schema.add_field(VECTOR_FIELD, DataType.FLOAT_VECTOR, dim=EMBED_DIM)
        index_params = client.prepare_index_params()
        index_params.add_index(
            field_name=VECTOR_FIELD,
            index_name=INDEX_NAME,
            index_type=INDEX_TYPE,
            metric_type=METRIC_TYPE,
            params=INDEX_BUILD_PARAMS,
        )
        client.create_collection(
            COLLECTION, schema=schema, index_params=index_params
        )
        result["created"] = True
    state = load_state(client)
    if state not in ("Loaded", "Loading"):
        try:
            client.load_collection(COLLECTION)
        except Exception:  # noqa: BLE001 - already loaded is fine
            pass
    result["load_state"] = load_state(client)
    return result


def fetch_documents(client, with_embedding=False, limit=16384):
    """Fetch all documents; optionally include raw embedding vectors."""
    fields = ["doc_id", "title", "category", "content", "concepts", "created_at"]
    if with_embedding:
        fields.append(VECTOR_FIELD)
    try:
        return client.query(
            COLLECTION,
            filter='doc_id != ""',
            output_fields=fields,
            limit=limit,
        )
    except TypeError:
        # Older clients reject the limit kwarg.
        return client.query(
            COLLECTION, filter='doc_id != ""', output_fields=fields
        )


def search_vectors(client, query_vector, limit=5, output_fields=None):
    """Vector similarity search; returns hits sorted by the metric."""
    fields = output_fields or [
        "doc_id", "title", "category", "content", "concepts", "created_at"
    ]
    hits = client.search(
        COLLECTION,
        data=[query_vector],
        anns_field=VECTOR_FIELD,
        search_params={
            "metric_type": METRIC_TYPE,
            "params": {"ef": SEARCH_EF},
        },
        limit=limit,
        output_fields=fields,
    )
    return hits[0] if hits else []


def _count_rows(client):
    """Row count: count(*) aggregation first, stats and full scan fallbacks."""
    try:
        rows = client.query(
            COLLECTION, filter='doc_id != ""', output_fields=["count(*)"]
        )
        if rows:
            value = rows[0].get("count(*)")
            if value is not None:
                return int(value)
    except Exception:  # noqa: BLE001 - fall through to stats
        pass
    try:
        stats = client.get_collection_stats(COLLECTION) or {}
        value = stats.get("row_count", 0)
        if value:
            return int(value)
    except Exception:  # noqa: BLE001 - fall through to full scan
        pass
    try:
        return len(fetch_documents(client))
    except Exception:  # noqa: BLE001
        return None


def collection_metadata(client):
    """Real Milvus metadata for the statistics dashboard."""
    meta = {"collection": COLLECTION}
    try:
        described = client.describe_collection(COLLECTION) or {}
        meta["description"] = described.get("description", "")
        meta["consistency_level"] = described.get("consistency_level_name", "")
        meta["collection_id"] = described.get("collection_id")
        dim = None
        fields = []
        for f in described.get("fields", []):
            name = f.get("name")
            params = f.get("params", {}) or {}
            fields.append({
                "name": name,
                "type": str(f.get("type", "")),
                "params": params,
            })
            if name == VECTOR_FIELD:
                dim = params.get("dim")
        meta["fields"] = fields
        meta["dim"] = dim if dim is not None else EMBED_DIM
    except Exception as exc:  # noqa: BLE001 - stats degrade gracefully
        meta["describe_error"] = str(exc)
        meta["dim"] = EMBED_DIM
    meta["row_count"] = _count_rows(client)
    try:
        names = client.list_indexes(COLLECTION) or []
        meta["indexes"] = names
        idx = None
        for name in names:
            if isinstance(name, str):
                idx = client.describe_index(COLLECTION, name)
                break
        if idx and isinstance(idx, dict):
            meta["index_type"] = idx.get("index_type", INDEX_TYPE)
            meta["metric_type"] = idx.get("metric_type", METRIC_TYPE)
            params = idx.get("params")
            if isinstance(params, str):
                try:
                    params = json.loads(params)
                except Exception:  # noqa: BLE001 - keep whatever parsed
                    params = {}
            if not isinstance(params, dict):
                params = {}
            for key in ("M", "efConstruction", "nlist"):
                if key in idx:
                    params[key] = idx[key]
            meta["index_params"] = params
            meta["index_state"] = idx.get("state")
            meta["indexed_rows"] = idx.get("indexed_rows")
            meta["index_total_rows"] = idx.get("total_rows")
        else:
            meta["index_type"] = INDEX_TYPE
            meta["metric_type"] = METRIC_TYPE
            meta["index_params"] = INDEX_BUILD_PARAMS
    except Exception as exc:  # noqa: BLE001
        meta["index_error"] = str(exc)
        meta["index_type"] = INDEX_TYPE
        meta["metric_type"] = METRIC_TYPE
        meta["index_params"] = INDEX_BUILD_PARAMS
    meta["load_state"] = load_state(client)
    return meta


# ---------------------------------------------------------------------------
# PCA projection and similarity math
# ---------------------------------------------------------------------------

def pca_project(vectors, query_vector=None):
    """Project embeddings onto their top-2 principal components.

    Pure-numpy PCA over the stored embeddings. Coordinates are scaled to
    [-1, 1]. Returns points, optional query point and explained variance.
    """
    import numpy as np

    count = len(vectors)
    if count == 0:
        return {
            "points": [],
            "query": None,
            "explained_variance": [0.0, 0.0],
            "method": "pca-2d",
        }
    X = np.array(vectors, dtype=np.float64)
    mean = X.mean(axis=0)
    Xc = X - mean
    if count == 1:
        comps = np.eye(X.shape[1])[:2]
        proj = np.zeros((1, 2), dtype=np.float64)
        explained = [0.0, 0.0]
    else:
        # SVD of the centered data gives principal components in Vt.
        _, s, vt = np.linalg.svd(Xc, full_matrices=False)
        comps = vt[:2]
        proj = Xc @ comps.T
        total = float((s ** 2).sum()) or 1.0
        explained = [
            round(float((s[k] ** 2) / total), 4) if k < len(s) else 0.0
            for k in (0, 1)
        ]
    scale_x = float(np.abs(proj[:, 0]).max()) if proj.size else 1.0
    scale_y = float(np.abs(proj[:, 1]).max()) if proj.size else 1.0
    sx = scale_x if scale_x > 1e-9 else 1.0
    sy = scale_y if scale_y > 1e-9 else 1.0
    points = [
        [round(float(proj[i, 0]) / sx, 4), round(float(proj[i, 1]) / sy, 4)]
        for i in range(count)
    ]
    query_point = None
    if query_vector is not None:
        q = (np.array(query_vector, dtype=np.float64) - mean) @ comps.T
        query_point = [
            round(float(q[0]) / sx, 4),
            round(float(q[1]) / sy, 4),
        ]
    return {
        "points": points,
        "query": query_point,
        "explained_variance": explained,
        "method": "pca-2d",
    }


def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(x * x for x in b)) or 1.0
    return dot / (na * nb)


# ---------------------------------------------------------------------------
# Keyword ranking (traditional search for the comparison view)
# ---------------------------------------------------------------------------

def keyword_rank(query, docs, top=5):
    """Classic keyword search: tf-idf over title (x2) + content stems."""
    q_stems = [s for s in stems_of(query) if s not in STOPWORDS]
    if not q_stems or not docs:
        return []
    n_docs = len(docs)
    stem_cache = []
    df = {}
    for doc in docs:
        body = "%s %s" % (doc.get("title", ""), doc.get("content", ""))
        doc_stems = stems_of(body)
        stem_cache.append(doc_stems)
        present = set(doc_stems)
        for s in q_stems:
            if s in present:
                df[s] = df.get(s, 0) + 1
    scored = []
    for doc, doc_stems in zip(docs, stem_cache):
        score = 0.0
        matched = []
        for s in q_stems:
            count = doc_stems.count(s)
            if count > 0:
                idf = math.log(1.0 + n_docs / (1.0 + df.get(s, 0)))
                score += count * idf
                matched.append(s)
        if score > 0:
            scored.append({
                "doc_id": doc.get("doc_id"),
                "title": doc.get("title"),
                "category": doc.get("category"),
                "content": doc.get("content"),
                "concepts": doc.get("concepts", ""),
                "keyword_score": round(score, 3),
                "matched_terms": matched,
            })
    scored.sort(key=lambda item: item["keyword_score"], reverse=True)
    return scored[:top]


# ---------------------------------------------------------------------------
# OpenServerless web-action request helpers
# ---------------------------------------------------------------------------

def request_data(args):
    """Merge query params and JSON body fields (top-level wins)."""
    data = dict(args) if isinstance(args, dict) else {}
    body = data.get("body")
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except Exception:  # noqa: BLE001 - malformed body falls back to {}
            body = {}
    merged = dict(body) if isinstance(body, dict) else {}
    ignored = {"body", "__ow_method", "__ow_headers", "__ow_path", "__ow_body"}
    merged.update({k: v for k, v in data.items() if k not in ignored})
    return merged


def request_method(args):
    return ((args or {}).get("__ow_method") or (args or {}).get("method") or "GET").upper()


def request_headers(args):
    headers = (args or {}).get("__ow_headers") or (args or {}).get("headers") or {}
    if isinstance(headers, dict):
        return {str(k).lower(): v for k, v in headers.items()}
    return {}


def request_route_id(args, data, resource_name):
    """Extract an item id from the route path or the request body."""
    for key in ("id", "%s_id" % resource_name, "docId", "doc_id"):
        value = data.get(key)
        if value not in (None, ""):
            return str(value)
    raw_path = str((args or {}).get("__ow_path") or (args or {}).get("path") or "").strip("/")
    if not raw_path:
        return ""
    parts = [p for p in raw_path.split("/") if p]
    if not parts:
        return ""
    if resource_name in parts:
        index = parts.index(resource_name)
        if index + 1 < len(parts):
            return parts[index + 1]
    return parts[-1]


def ms_between(start):
    return round((time.perf_counter() - start) * 1000.0, 2)