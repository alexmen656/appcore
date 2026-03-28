import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
      customProps: { icon: 'intro' },
    },
    {
      type: 'category',
      label: 'Infrastructure',
      customProps: { icon: 'Infrastructure' },
      items: [
        {
          type: 'doc',
          id: 'infrastructure/fastlane-worker',
          label: 'Fastlane Worker',
          customProps: { icon: 'fastlane-worker' },
        },
      ],
    },
    {
      type: 'category',
      label: 'iOS',
      customProps: { icon: 'iOS' },
      items: [
        {
          type: 'doc',
          id: 'ios/code-signing',
          label: 'Code Signing',
          customProps: { icon: 'code-signing' },
        },
      ],
    },
  ],
};

export default sidebars;
