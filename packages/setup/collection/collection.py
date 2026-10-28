"""setup/collection - private setup action.

Creates the Milvus collection if it does not exist (never drops or
recreates an existing one) and seeds the 30 sample documents exactly once,
guarded by a durable Redis seed marker built from ctx.REDIS_PREFIX.
"""

import hashlib
import time

import veclib

SEED_VERSION = "v1"
SEED_MARKER = "vector-explorer:seeded:%s" % SEED_VERSION

SEED_DOCUMENTS = [
    ("Quantum Computing Processors", "Technology",
     "Quantum computers use qubits that exist in superposition, enabling certain calculations exponentially faster than classical processors. Companies like IBM and Google race to build error-corrected quantum machines."),
    ("How Solid-State Drives Work", "Technology",
     "Solid-state drives store data in NAND flash memory chips instead of spinning magnetic platters. With no moving parts, SSDs deliver faster boot times and greater durability than hard disks."),
    ("The Rise of 5G Networks", "Technology",
     "Fifth-generation wireless networks beam data at gigabit speeds with very low latency. Massive antenna arrays and millimeter-wave spectrum power everything from streaming video to remote surgery."),
    ("Inside Modern Web Browsers", "Technology",
     "A web browser parses HTML, executes JavaScript in a sandboxed engine, and paints pixels to the screen through a rendering pipeline. Chromium and Firefox compete on speed, privacy, and standards support."),
    ("Lithium-Ion Battery Technology", "Technology",
     "Lithium-ion cells shuttle charged atoms between graphite anodes and metal-oxide cathodes through liquid electrolyte. This rechargeable chemistry powers phones, electric vehicles, and grid storage."),
    ("The Structure of DNA", "Science",
     "Deoxyribonucleic acid is a double helix of paired nucleotide bases encoding the blueprint of living organisms. Sequencing this molecule unlocked genetics, forensic identification, and modern biotechnology."),
    ("CRISPR Gene Editing", "Science",
     "CRISPR-Cas9 acts like molecular scissors, cutting DNA at precise sequences guided by RNA. Scientists use it to study genes, treat inherited diseases, and engineer drought-resistant crops."),
    ("How Vaccines Train the Immune System", "Science",
     "Vaccines expose the body to a harmless fragment or weakened pathogen so it learns to produce antibodies and memory cells. This immunization makes later infections far less dangerous."),
    ("Plate Tectonics and Continental Drift", "Science",
     "Earth's crust is broken into rigid plates floating on the mantle, drifting centimeters per year. Their collisions raise mountains, trigger earthquakes, and open ocean basins."),
    ("The Physics of Superconductivity", "Science",
     "Below a critical temperature, certain materials conduct electricity with zero resistance as electrons pair up into Cooper pairs. Superconducting magnets power MRI scanners and particle accelerators."),
    ("Inside Black Holes", "Astronomy",
     "A black hole is a region where gravity is so intense that not even light can escape its event horizon. Supermassive ones sit at galaxy centers, and colliding ones ripple spacetime itself."),
    ("The Life Cycle of Stars", "Astronomy",
     "Stars ignite when gravity squeezes hydrogen into fusion in their cores. Massive giants end as neutron stars or black holes, while sun-like stars shed nebulae and fade into white dwarfs."),
    ("Exploring Mars with Rovers", "Astronomy",
     "Robotic rovers like Curiosity and Perseverance crawl across Martian terrain, drilling rock and sniffing the atmosphere. Their instruments search for water ice and signs of ancient microbial life."),
    ("The Expanding Universe and Dark Energy", "Astronomy",
     "Distant galaxies recede faster the farther they are, revealing that space itself is stretching. Dark energy drives this accelerating expansion of the cosmos."),
    ("The Search for Exoplanets", "Astronomy",
     "Astronomers detect planets around other stars by watching for tiny dips in brightness and wobbles in stellar motion. Thousands of worlds have been found, from hot Jupiters to temperate super-Earths."),
    ("How Neural Networks Learn", "Artificial Intelligence",
     "Artificial neural networks are layered functions with adjustable weights. Backpropagation nudges millions of parameters to minimize error on training data, letting deep models recognize images, speech, and text."),
    ("Large Language Models Explained", "Artificial Intelligence",
     "Large language models predict the next token in a sequence using self-attention over huge text corpora. The same transformer architecture powers chat assistants, translation, and code generation."),
    ("Computer Vision and Convolutional Networks", "Artificial Intelligence",
     "Convolutional layers slide filters across pixels to detect edges, textures, and shapes at increasing abstraction. This is how machines classify images, detect tumors in scans, and steer autonomous cars."),
    ("Reinforcement Learning from Rewards", "Artificial Intelligence",
     "Reinforcement learning agents learn by trial and error, receiving rewards for good actions. The technique conquered the game of Go and trains robots to walk."),
    ("Embeddings and Vector Databases", "Artificial Intelligence",
     "Embeddings compress words, images, and documents into dense numeric vectors that capture meaning. Vector databases index these embeddings for fast nearest-neighbor search, powering semantic retrieval and recommendation systems."),
    ("How Musical Instruments Produce Sound", "Music",
     "Instruments vibrate strings, air columns, or membranes to create waves at specific frequencies. Tone, timbre, and harmonics give each violin, flute, or drum its distinctive voice."),
    ("The Science of Harmony and Scales", "Music",
     "Western harmony stacks pitches at pleasing ratios like the octave and perfect fifth. Scales divide the octave into steps, giving melodies their emotional character."),
    ("Rhythm, Tempo, and Groove", "Music",
     "Rhythm organizes beats into patterns, with tempo setting their speed in beats per minute. Syncopation and swing make listeners move to the groove."),
    ("The Craft of Music Production", "Music",
     "Producers layer tracks, tune vocals, and balance frequencies across the mixing desk. Digital audio workstations and synthesizers shape recordings before mastering."),
    ("Opera and the Human Voice", "Music",
     "Opera combines drama, orchestra, and classically trained singers whose voices project over an ensemble without amplification. Arias stretch breath control and range to extremes."),
    ("How Photosynthesis Feeds the World", "Nature",
     "Plants capture sunlight in chlorophyll to split water and fix carbon dioxide into sugar, releasing oxygen as a byproduct. This quiet chemistry underpins nearly every food chain on Earth."),
    ("Coral Reefs: Rainforests of the Sea", "Nature",
     "Coral reefs are living colonies of tiny polyps that build limestone cities in warm shallow water. They shelter a quarter of marine species and bleach when oceans overheat."),
    ("The Secret Life of Mycorrhizal Fungi", "Nature",
     "Fungal threads trade minerals with tree roots for sugars, connecting forests into underground networks. Mycorrhizae help trees communicate and share nutrients."),
    ("Animal Migration Across the Planet", "Nature",
     "Birds, whales, and butterflies navigate thousands of kilometers using magnetic fields, stars, and scent. Migration follows seasonal food and breeding grounds."),
    ("Wildfires and Forest Regeneration", "Nature",
     "Wildfires release seeds from cones and clear dead undergrowth, making room for new saplings. Some pine forests depend on fire to regenerate."),
]


def seed_doc_id(title):
    digest = hashlib.sha1(("vector-explorer:" + title).encode("utf-8")).hexdigest()
    return digest[:16]


def main(args, ctx=None):
    if not ctx or not hasattr(ctx, "MILVUS"):
        return {"ok": False, "error": "Milvus is not configured for this action"}

    started = time.perf_counter()
    client = ctx.MILVUS

    # 1. Ensure the collection exists and is loaded (idempotent).
    ensured = veclib.ensure_collection(client)

    # 2. Count current rows.
    rows = veclib._count_rows(client)
    if rows is None:
        rows = 0

    seeded = 0
    skipped = False
    marker_present = False

    # 3. Seed only once: durable Redis marker + non-empty collection guard.
    redis = getattr(ctx, "REDIS", None)
    prefix = getattr(ctx, "REDIS_PREFIX", "") or ""
    marker_key = prefix + SEED_MARKER
    if redis is not None:
        try:
            marker_present = bool(redis.exists(marker_key))
        except Exception:  # noqa: BLE001 - marker is a guard, not a gate
            marker_present = False

    if marker_present or rows > 0:
        skipped = True
    else:
        now = int(time.time())
        rows_data = []
        embeddings = veclib.embed_many([d[2] for d in SEED_DOCUMENTS])
        for (title, category, content), vector in zip(SEED_DOCUMENTS, embeddings):
            rows_data.append({
                "doc_id": seed_doc_id(title),
                "title": title,
                "category": category,
                "content": content,
                "concepts": ",".join(veclib.concepts_of(content))[:1000],
                "created_at": now,
                "embedding": vector,
            })
        client.insert(veclib.COLLECTION, data=rows_data)
        seeded = len(rows_data)
        if redis is not None:
            try:
                redis.set(marker_key, str(seeded), nx=True)
            except Exception:  # noqa: BLE001 - next run re-checks row count
                pass

    # 4. Read back the final state.
    final_rows = veclib._count_rows(client)

    return {
        "ok": True,
        "collection": veclib.COLLECTION,
        "created": ensured.get("created", False),
        "load_state": ensured.get("load_state", "Unknown"),
        "seed_marker": SEED_MARKER,
        "seeded": seeded,
        "skipped_seeding": skipped,
        "row_count": final_rows,
        "embedding_model": veclib.EMBED_MODEL,
        "categories": veclib.CATEGORIES,
        "elapsed_ms": veclib.ms_between(started),
    }