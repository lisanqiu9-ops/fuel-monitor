# Product Design Review - 油耗监控

Date: 2026-06-05

## Scope

- Surface: mobile-first fuel consumption web app.
- Flow focus: overview, quick OCR recognition, add record, history, record detail.
- Evidence: local source inspection of `src/App.tsx`, `src/components/OverviewTab.tsx`, `src/components/AddRecordTab.tsx`, `src/components/HistoryModal.tsx`, `src/components/RecordDetailModal.tsx`, and `src/index.css`.
- Limit: local browser capture was blocked by the approval layer, so this review is code-grounded rather than screenshot-grounded.

## Audit Findings

1. Overview action hierarchy is clearer than before, but `添加` and `识别` are still visually equal.
   - Health: medium.
   - Why it matters: recognition is a camera/upload workflow with confirmation, while add is manual entry. Equal tiles make the two actions feel like the same kind of navigation.
   - Recommendation: make `识别` a primary capture action with camera/upload wording, a progress-ready preview area, and a secondary `手动添加` action.

2. Quick OCR progress is much improved.
   - Health: good.
   - Evidence: `App.tsx` now has an overlay with compression, recognition, merge labels and percentage progress.
   - Recommendation: keep this global overlay, but add a post-selection staging state on the overview screen so the user immediately knows selected photos are being handled.

3. The add page OCR area is still visually heavier than the rest of the soft-mist theme.
   - Health: medium.
   - Evidence: `AddRecordTab.tsx` uses dark card classes that are remapped by theme CSS, but the structure still reads like a dark-form module.
   - Recommendation: convert OCR into a lighter two-step capture panel: photo queue first, then confirmation sheet.

4. History and detail pages now match the soft-mist direction better.
   - Health: good.
   - Evidence: `HistoryModal.tsx`, `RecordDetailModal.tsx`, and `index.css` use warm light surfaces, rounded controls, translucent cards, and a mobile page-style back button.
   - Recommendation: reduce repeated large card treatment in details. Use grouped rows and compact comparison bars to avoid a page that feels stacked too deep.

5. Bottom navigation works, but the central `记录` tab competes with `识别`.
   - Health: medium.
   - Recommendation: keep bottom nav for durable sections and reserve quick capture for the overview/action area. Do not add OCR as a fifth nav item.

6. Empty state can do more work.
   - Health: medium.
   - Evidence: overview empty state says no records and offers `添加第一条`.
   - Recommendation: offer two first-run paths: `拍照识别小票` and `手动添加记录`, with a small note explaining that OCR can merge receipt and dashboard data.

## Recommended Direction

Pick Option 1 if you want to keep the current product personality. It is the smallest design shift and best matches the existing "柔雾" work.

Pick Option 2 if you want the app to feel more like a useful car dashboard.

Pick Option 3 if the main goal is speed: open, scan, confirm, done.

Visual mockups: `product-design-options.html`.
