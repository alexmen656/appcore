import React, {type ReactNode} from 'react';
import Link from '@theme-original/DocSidebarItem/Link';
import type LinkType from '@theme/DocSidebarItem/Link';
import type {WrapperProps} from '@docusaurus/types';
import {SidebarIcon} from '../icons';

type Props = WrapperProps<typeof LinkType>;

export default function LinkWrapper(props: Props): ReactNode {
  const iconKey = (props.item as any).customProps?.icon as string | undefined;

  if (!iconKey) {
    return <Link {...props} />;
  }

  return (
    <div className="sidebar-item-with-icon">
      <SidebarIcon name={iconKey} className="sidebar-icon" />
      <Link {...props} />
    </div>
  );
}
