/* =====================================================================
   INHALT — alles, was du später ändern willst, steht in dieser Datei.
   Sie wird von allen Seiten geladen (index, about, projects, cv, contact).
   ===================================================================== */
window.SITE = {
  first: "LENNY",
  last:  "GUJER",
  role:  "Electrical Engineering Student @ ETH Zürich",
  about: "Engineering is where I like to turn ideas into working systems. What interests me most is the point where electronics, programming and mechanical systems meet.",
  email:    "gujerl@ethz.ch",
  github:   "https://github.com/lennygujer",
  linkedin: "https://www.linkedin.com/in/lenny-gujer-640094374",
  cvFile:   "lebenslauf.pdf",

  generator: {
    title:   "Axial flux generator",
    summary: "A self-built generator in which permanent magnets rotate past a stator of copper coils. Version 1 showed what needed to change. Version 2 is being built right now.",
    repo:    "https://github.com/lennygujer",          // ← Link zum Generator-Repository eintragen

    /* Aufbau des 3D-Modells. Später an den echten Generator anpassen. */
    magnets: 12,                                       // Anzahl Magnete pro Rotor
    coils:   9,                                        // Anzahl Spulen im Stator (Vielfaches von 3)

    /* Kennzahlen unter der Einleitung. "tbd" ersetzen, sobald die Werte feststehen. */
    specs: [
      ["Version", "V2"],
      ["Status", "Epoxy casting"],
      ["Magnets", "tbd"],
      ["Coils", "tbd"],
      ["Rated output", "tbd"]
    ],

    /* Bau-Etappen. status: "done" | "active" | "planned".
       label = kurzer Name der Etappe, image = optionales Foto (z.B. "Bilder/epoxy.jpg").
       focus = was das 3D-Modell in dieser Etappe zeigt:
               "all" (ganzer Generator) | "stator" | "iron" | "frame" | "assembly" | "test" */
    stages: [
      { label: "V1 PROTOTYPE", status: "done", focus: "all",
        title: "Version 1, the first build",
        text:  "The first generator was built from start to finish. It exposed several problems in the design, and those lessons became the brief for version 2.",
        image: "" },
      { label: "EPOXY CASTING", status: "active", focus: "stator",
        title: "Casting the coils in epoxy",
        text:  "For version 2 the wound coils are cast in epoxy, which locks them in position and turns them into one rigid stator disc. This is the step I am working on at the moment.",
        image: "" },
      { label: "BACK IRON", status: "planned", focus: "iron",
        title: "Having the back iron made",
        text:  "The back iron closes the magnetic circuit behind the magnets. This part will be manufactured externally.",
        image: "" },
      { label: "CAD DESIGN", status: "planned", focus: "frame",
        title: "Designing everything around it in CAD",
        text:  "Once stator and back iron are fixed, the rest of the machine is designed around them in CAD.",
        image: "" },
      { label: "ASSEMBLY", status: "planned", focus: "assembly",
        title: "Assembling the generator",
        text:  "All parts come together into the finished machine.",
        image: "" },
      { label: "TESTING", status: "planned", focus: "test",
        title: "Testing and measuring",
        text:  "The generator is spun up and measured to see how version 2 compares with the first build.",
        image: "" }
    ]
  },

  /* Über mich: Foto, kurze Absätze (der erste wird gross gesetzt) und Stichworte. */
  me: {
    image: "Bilder/profil.jpeg",
    text: [
      "I'm Lenny, and I study Electrical Engineering at ETH Zürich, where I started my bachelor's in 2025.",
      "I'm especially drawn to electrical machines, embedded systems and anything I can design, build and test myself.",
      "Most of my free time goes into projects like the generator, where I can try out what I learn in lectures."
    ],
    facts: [
      ["University", "ETH Zürich"],
      ["Degree", "BSc Electrical Engineering"],
      ["Since", "2025"],
      ["Now building", "Axial flux generator V2"]
    ]
  },

  /* Weitere Projekte: neuer Eintrag = neue Zeile. */
  projects: [
    { title: "POMI", when: "2026, personal project",
      text:  "A custom-built focus timer inspired by the Pomodoro technique. Work time, break duration and number of breaks are set directly on the device.",
      tags:  ["C++", "Arduino", "CAD"],
      image: "Bilder/projekt1.jpg",
      repo:  "https://github.com/lennygujer/Pomi" }
  ],

  timeline: [
    { when: "2025 to today", what: "BSc Electrical Engineering", where: "ETH Zürich" },
    { when: "2020 to 2024",  what: "Matura",                     where: "Gymnasium Oberaargau" }
  ],

  stack: [
    ["Programming", "Python, C, C++, MATLAB"],
    ["Hardware",    "Microcontrollers, sensors, electronics, PCB"],
    ["Engineering", "Control systems, signal processing, CAD, robotics"],
    ["Tools",       "Git, GitHub, Linux, MATLAB, SolidWorks"]
  ]
};
