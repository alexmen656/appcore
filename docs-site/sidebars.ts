import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "intro",
    {
      type: "category",
      label: "Infrastructure",
      items: ["infrastructure/fastlane-worker"],
    },
    {
      type: "category",
      label: "iOS",
      items: ["ios/code-signing"],
    },
  ],
};

export default sidebars;
