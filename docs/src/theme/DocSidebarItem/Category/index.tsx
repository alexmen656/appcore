import React, {type ReactNode} from 'react';
import Category from '@theme-original/DocSidebarItem/Category';
import type CategoryType from '@theme/DocSidebarItem/Category';
import type {WrapperProps} from '@docusaurus/types';
import {SidebarIcon} from '../icons';

type Props = WrapperProps<typeof CategoryType>;

export default function CategoryWrapper(props: Props): ReactNode {
  const iconKey = (props.item as any).customProps?.icon as string | undefined;

  if (!iconKey) {
    return <Category {...props} />;
  }

  return (
    <div className="sidebar-item-with-icon">
      <SidebarIcon name={iconKey} className="sidebar-icon" />
      <Category {...props} />
    </div>
  );
}
