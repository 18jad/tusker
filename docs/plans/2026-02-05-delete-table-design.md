# Delete Table Feature Design

## Overview

Add ability to delete tables with a type-to-confirm modal for safety.

## UI Components

### Entry Points
1. **Context menu** - Right-click on table name in sidebar
2. **Toolbar button** - Delete button in TableView toolbar

### Delete Confirmation Modal
- Warning icon and "Delete Table" heading
- Table name displayed as `schema.table_name`
- Row count: "This table contains X rows"
- Warning: "This action cannot be undone. All data will be permanently deleted."
- Text input requiring exact table name match
- Delete button disabled until input matches
- Cancel button always available

## Data Flow

1. User triggers delete from context menu or toolbar
2. Modal opens with table info
3. User types table name to confirm
4. Execute `DROP TABLE "schema"."table_name"`
5. On success: close modal, close table tab, refresh sidebar
6. On error: display error in modal

## Files

### New
- `src/components/modals/DeleteTableModal.tsx`
- `src/components/ui/ContextMenu.tsx`

### Modified
- `src/stores/uiStore.ts` - Add deleteTableModal state
- `src/components/layout/Sidebar.tsx` - Add context menu
- `src/components/table/TableView.tsx` - Add toolbar button
- `src/App.tsx` - Mount modal
