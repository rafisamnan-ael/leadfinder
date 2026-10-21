import { ensureSeeded } from "../src/lib/seed";
import { SYSTEM_TEMPLATES } from "../src/lib/templates";

ensureSeeded()
  .then((seeded) => {
    console.log(
      seeded
        ? `Seeded ${SYSTEM_TEMPLATES.length} built-in templates + default settings.`
        : "Templates already present — seed skipped."
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
