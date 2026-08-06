// Equipment preset library. Seeded into `equipment_presets`, after which it is
// editable from Settings — this file is the initial load, not the source of truth.

/** Bundles: a crew's standard loadout as one row instead of twenty. */
export const BUNDLES = [
  ["General Tools", "Power drill w/ bit and driver set, hammer, tape measure, utility knife, adjustable wrench, pliers, screwdriver set, level, stud finder, flashlight"],
  ["General Handyman Kit", "General Tools plus assorted screws/anchors/nails, wall anchors, picture hanging hardware, caulk gun, painter's tape, wood glue, zip ties, shop rags"],
  ["General Moving Kit", "2-wheel dolly, 4-wheel furniture dolly, moving blankets (6+), ratchet straps, shoulder straps/forearm forklift, stretch wrap, tape gun, basic hand tools for disassembly"],
  ["General Assembly Kit", "Power drill w/ full driver bit set, Allen/hex key set, rubber mallet, small pry bar, level, needle-nose pliers, phone light"],
  ["General Cleaning Kit", "All-purpose cleaner, glass cleaner, bathroom/tile cleaner, degreaser, microfiber cloths, sponges, scrub brushes, toilet brush, gloves, trash bags, broom, dustpan, mop and bucket"],
  ["Deep Cleaning Kit", "General Cleaning Kit plus oven cleaner, grout brush, magic erasers, scraper blade, steam cleaner or carpet spotter, extension duster, shop vacuum"],
  ["General Junk Haul Kit", "Work gloves, contractor bags, hand truck, furniture dolly, ratchet straps, tarp, push broom, dustpan, bolt cutters, reciprocating saw for breakdown"],
  ["General Demo Kit", "Sledgehammer, pry bar/wrecking bar, reciprocating saw w/ demo blades, hammer, tin snips, utility knife, contractor bags, respirator, eye protection, heavy gloves"],
  ["General Yard Kit", "Push mower, string trimmer, leaf blower, rake, leaf bags, hedge shears, loppers, hand pruners, shovel, work gloves"],
  ["General Landscaping Kit", "General Yard Kit plus wheelbarrow, garden spade, edger, hard rake, tarp, gloves, knee pads"],
  ["General Painting Kit", "Rollers and covers, brushes (angled and flat), paint tray, drop cloths, painter's tape, extension pole, putty knife, spackle, sandpaper, stir sticks, rags"],
  ["General Plumbing Kit", "Pipe wrench, adjustable wrenches, channel locks, plunger, drain snake, teflon tape, plumber's putty, bucket, towels, basin wrench"],
  ["General Electrical Kit", "Voltage tester, wire strippers, needle-nose pliers, electrical tape, wire nuts, screwdriver set, headlamp, outlet tester"],
  ["General Safety Gear", "Work gloves, safety glasses, dust masks/N95, knee pads, steel toe boots, high-vis vest, first aid kit"],
  ["General Floor Protection Kit", "Floor runners, ram board or masonite, door jamb protectors, corner guards, painter's tape, moving blankets"],
  ["General Tech Kit", "Precision screwdriver set, USB and HDMI cables, ethernet cable and crimper, USB drive, power strip, cable ties, laptop for diagnostics, phone hotspot"],
  ["General TV Mount Kit", "Stud finder, level, drill w/ masonry and wood bits, socket set, lag bolts and anchors, cable management kit, tape measure"],
  ["General Ladder Set", "6 ft step ladder and extension ladder, ladder stabilizer, work platform"],
  ["General Hauling Straps", "Ratchet straps, cam straps, bungee cords, rope, moving blankets, tarp"],
];

/** Individual items, grouped by the section they came from. */
export const ITEMS = {
  Moving: [
    "Dolly (2-wheel hand truck)", "Appliance dolly w/ stair strap", "Furniture dolly (4-wheel)",
    "Piano board", "Moving blankets", "Stretch wrap", "Packing tape and tape gun",
    "Shoulder harness straps", "Forearm forklift straps", "Ratchet straps", "Cam buckle straps",
    "Rope", "Bungee cords", "Furniture sliders", "Mattress bags", "TV box", "Wardrobe boxes",
    "Moving boxes (assorted)", "Packing paper", "Bubble wrap", "Loading ramp",
    "E-track and load bars", "Door jamb protectors", "Floor runners", "Corner guards",
    "Hand truck stair climber", "Dolly straps", "Toe jack / furniture lifter",
  ],
  Cleaning: [
    "Vacuum (upright)", "Shop vacuum", "Backpack vacuum", "Carpet spotter / extractor",
    "Steam cleaner", "Mop and bucket", "Flat mop w/ pads", "Broom and dustpan", "Push broom",
    "Microfiber cloths", "Sponges and scrub pads", "Scrub brushes", "Grout brush", "Toilet brush",
    "Squeegee", "Extension duster", "Magic erasers", "Scraper w/ blades", "Spray bottles",
    "All-purpose cleaner", "Glass cleaner", "Bathroom and tile cleaner", "Degreaser",
    "Oven cleaner", "Disinfectant", "Bleach", "Floor cleaner", "Stainless steel polish",
    "Wood polish", "Rubber gloves", "Trash bags", "Contractor bags", "Pressure washer",
    "Window cleaning kit w/ pole", "Air mover / blower fan", "Odor eliminator / air freshener",
  ],
  "Junk Removal": [
    "Contractor bags", "Work gloves", "Hand truck", "Furniture dolly", "Appliance dolly", "Tarp",
    "Ratchet straps", "Bolt cutters", "Reciprocating saw", "Sledgehammer", "Pry bar",
    "Utility knife", "Push broom and dustpan", "Shovel", "Wheelbarrow", "Bin / rolling cart",
    "Dust masks", "Safety glasses", "Bungee cargo net", "Furniture sliders",
  ],
  Handyman: [
    "Power drill / driver", "Impact driver", "Drill bit set", "Driver bit set", "Masonry bits",
    "Hole saw set", "Hammer", "Rubber mallet", "Screwdriver set", "Adjustable wrench",
    "Socket and ratchet set", "Allen / hex key set", "Pliers set", "Channel locks", "Vise grips",
    "Wire cutters", "Tape measure", "Level", "Laser level", "Stud finder", "Speed square",
    "Chalk line", "Utility knife", "Hacksaw", "Handsaw", "Circular saw", "Reciprocating saw",
    "Jigsaw", "Miter saw", "Oscillating multi-tool", "Orbital sander", "Caulk gun",
    "Caulk and sealant", "Wood glue", "Construction adhesive", "Spackle and putty knife",
    "Sandpaper", "Clamps", "Pry bar", "Pipe wrench", "Plunger", "Drain snake", "Teflon tape",
    "Plumber's putty", "Basin wrench", "Voltage tester", "Wire strippers", "Electrical tape",
    "Wire nuts", "Outlet tester", "Fish tape", "Step ladder", "Extension ladder", "Work light",
    "Headlamp", "Extension cord", "Power strip", "Generator", "Shop vacuum",
    "Tool bag / rolling tool box", "Assorted screws and fasteners", "Wall anchors",
    "Picture hanging hardware", "Zip ties", "Duct tape", "Painter's tape", "Drop cloths",
  ],
  "Yard Work": [
    "Push mower", "Self-propelled mower", "Riding mower", "String trimmer / weed eater", "Edger",
    "Leaf blower (handheld)", "Leaf blower (backpack)", "Hedge trimmer (powered)", "Hedge shears",
    "Loppers", "Hand pruners", "Pole saw", "Chainsaw", "Rake (leaf)", "Rake (hard / landscape)",
    "Shovel", "Garden spade", "Post hole digger", "Hoe", "Wheelbarrow", "Garden cart",
    "Leaf bags", "Tarp", "Garden hose and nozzle", "Sprinkler", "Spreader (fertilizer / seed)",
    "Weed puller", "Landscape fabric", "Edging stakes", "Snow shovel", "Snow blower",
    "Ice melt spreader", "Work gloves", "Knee pads", "Gas can",
  ],
  "Tech Consultation": [
    "Laptop", "Precision screwdriver set", "Anti-static wrist strap", "USB drive",
    "Bootable recovery drive", "HDMI cable", "USB-C and USB-A cables", "Ethernet cable",
    "Ethernet crimper and testers", "Cable tester", "Power strip / surge protector",
    "Cable ties and management kit", "Wi-Fi analyzer", "Router / mesh unit", "Mobile hotspot",
    "External hard drive", "SATA / NVMe adapter", "Compressed air", "Contact cleaner",
    "Label maker", "Mounting hardware", "Stud finder", "Drill w/ masonry bits", "Level",
  ],
  // Vehicle *type* is a separate multi-select on the entity; these are accessories.
  "Vehicles & Transport": [
    "Cargo trailer", "Utility trailer", "Hitch and ball mount", "Trailer wiring adapter",
    "Loading ramp", "Ramp extension", "Roof rack", "Cargo net", "Tie-down anchors",
    "Wheel chocks", "Spare tire and jack", "Jumper cables", "Fuel can", "Dash cam",
  ],
  "Safety & Site Protection": [
    "Work gloves", "Cut-resistant gloves", "Safety glasses", "Face shield", "N95 / dust masks",
    "Respirator", "Ear protection", "Hard hat", "High-vis vest", "Steel toe boots", "Knee pads",
    "Back support belt", "First aid kit", "Fire extinguisher", "Traffic cones", "Caution tape",
    "Wet floor signs", "Floor runners", "Ram board", "Door jamb protectors", "Corner guards",
    "Drop cloths", "Plastic sheeting",
  ],
};

/**
 * Flattens to rows. Item names repeat across sections (Work gloves appears in
 * four), and the table keys on a unique name, so the first section wins and
 * later duplicates are dropped. Bundles sort first.
 */
export function buildRows() {
  const rows = [];
  const seen = new Set();

  BUNDLES.forEach(([item_name, default_note], i) => {
    seen.add(item_name.toLowerCase());
    rows.push({ item_name, default_note, category: "Bundles", sort_order: i });
  });

  let order = 1000;
  for (const [category, names] of Object.entries(ITEMS)) {
    for (const item_name of names) {
      const key = item_name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ item_name, default_note: null, category, sort_order: order++ });
    }
  }

  return rows;
}
