# Steel Bending Order System - Tata Steel Thailand

เอกสารนี้สรุประบบสั่งพับเหล็กปัจจุบัน และแนวทางเตรียมระบบสำหรับ daily 10:00 cutoff, PDF generation และ factory notification โดยไม่แก้ Power Automate โดยตรงจากฝั่ง frontend

## Current System Overview

- Frontend: HTML + Vanilla JavaScript
- Hosting: GitHub Pages / static hosting
- Backend: Power Automate HTTP trigger flows
- Database: Excel file on SharePoint (`Input_DB.xlsx`)
- Main pages:
  - `index.html` - login / entry page
  - `steel_bend_order.html` - order submission form
  - `steel_bend_tracking.html` - order tracking page

Current order submission works by sending one HTTP POST payload per item to Power Automate. Power Automate writes each payload into the Excel table.

## Order Payload Mapping

`steel_bend_order.html` sends these fields:

| Payload field | Source in frontend | Excel column / usage |
| --- | --- | --- |
| `date` | `#oDate` | `Date` |
| `plant` | `#plant-${id}` | `Plant` |
| `item_description` | `#mat-${id}` | `Item Description` |
| `customer_group` | selected group pill | `Customer Group` |
| `tons` | `#ton-${id}` | `Tons` |
| `pcs` | `#pcs-${id}` | `Pcs` |
| `sales_order_no` | `#so-${id}` | `Sales Order No.` |
| `customer_name` | `#cust-val-${id}` | `Customer Name` |
| `sales_person` | `#sales-val-${id}` fallback to group | `Sales Person` |
| `incoterms` | `#term-${id}` fallback `EXW` | `Incoterms` |
| `order_remark` | `#remark` | `Order Remark` |
| `unit_weight` | `UW[mat]` fallback `0` | `Unit Weight` |
| `submitter_email` | email input + domain | `submitter_email` |
| `status_text` | constant `Pending` | future `Status_Text` |

Backward-compatible aliases currently kept in the payload:

- `remark` mirrors `incoterms` for older flows that previously used `remark` as Incoterms.
- `receive_date` and `request_date` mirror the receive date input if a future Excel/flow mapping supports it.

## Excel Column Mapping

Current `Input_DB.xlsx` input table columns:

1. `Date`
2. `Plant`
3. `Item Description`
4. `Customer Group`
5. `Tons`
6. `Pcs`
7. `Sales Order No.`
8. `Customer Name`
9. `Sales Person`
10. `Incoterms`
11. `Order Remark`
12. `Unit Weight`
13. `Status`
14. `submitter_email`

Do not remove or rename current columns. Add future columns only at the end of the Excel table to avoid breaking existing flows.

Recommended new columns to append:

1. `OrderID`
2. `Status_Text`
3. `Cutoff_Batch_ID`
4. `Cutoff_Date`
5. `Sent_To_Plant_At`
6. `PDF_File_Name`
7. `PDF_File_URL`
8. `Error_Message`

Status compatibility:

- Keep old `Status` TRUE/FALSE column.
- Use new `Status_Text` as the primary workflow status.
- `Pending` = order received, waiting for 10:00 cutoff.
- `Sent` = included in cutoff PDF and sent to factory.
- `Error` = cutoff or send failed.
- `Cancelled` = cancelled order.

## Tracking Page Logic

`steel_bend_tracking.html`:

- Auto-loads all rows on page load with `loadAll()`.
- Keeps manual Refresh.
- Supports filters for customer group, plant, item search, and status.
- Status logic prefers `Status_Text` / `status_text`, then falls back to old `Status` TRUE/FALSE.
- Pending rows sort above Sent/Done/Error/Cancelled rows.
- Incoterms display reads from the `Incoterms` Excel column.
- Receive Date column is hidden unless loaded data contains receive/request date fields.
- Table uses horizontal scroll for desktop and mobile.

## Power Automate Flow 5 Target Design

Name: `Steel_Bend_05_DailyCutoffPDF`

Trigger:

- Recurrence every day at 10:00
- Time zone: SE Asia Standard Time

Recommended logic:

1. List rows from `Input_DB.xlsx`.
2. Filter rows where:
   - `Status_Text` = `Pending`
   - `Plant` = `SCSC`
3. Generate `Batch_ID`, for example `SCSC-YYYYMMDD-1000`.
4. Write selected rows into `SCSC_Batch_Input`.
5. Generate PDF from the SCSC form template.
6. Save the PDF to SharePoint.
7. Send email to the SCSC factory with the PDF/link.
8. If email succeeds, update selected `Input_DB.xlsx` rows:
   - `Status` = `TRUE`
   - `Status_Text` = `Sent`
   - `Cutoff_Batch_ID` = `Batch_ID`
   - `Cutoff_Date` = today
   - `Sent_To_Plant_At` = now
   - `PDF_File_Name` = generated file name
   - `PDF_File_URL` = generated file URL
9. If any step fails, update selected rows:
   - `Status_Text` = `Error`
   - `Error_Message` = error detail

Future extension:

- Duplicate the plant filter and template branch for `NTS` when the NTS factory PDF process is ready.
- Consider one shared flow with plant-specific branches, or separate plant flows if ownership differs.

## Daily 10:00 Cutoff Process

Before 10:00:

- Users submit orders throughout the day.
- New rows stay as `Status_Text = Pending`.
- Old `Status` should remain FALSE/blank until sent.

At 10:00:

- Flow 5 collects all Pending rows by plant.
- Flow 5 creates a batch ID.
- Flow 5 generates and saves a PDF form.
- Flow 5 emails the factory.
- Flow 5 marks included rows as Sent.

After 10:00:

- Tracking page shows Sent rows as completed/sent.
- Any newly submitted orders remain Pending for the next cutoff batch.

## Backup Checklist

Before changing Excel schema or Power Automate:

- Download a copy of `Input_DB.xlsx`.
- Export existing Power Automate flows.
- Save a copy of current HTML files.
- Confirm table names and column names in Excel.
- Add new Excel columns only at the end of the table.
- Test with a copied workbook or test table before production.

## Deployment Checklist

Before publishing frontend changes:

- Confirm `steel_bend_order.html` can submit an order successfully.
- Confirm Power Automate writes all current required columns.
- Confirm `status_text = Pending` is ignored safely or mapped to `Status_Text` after the Excel column is added.
- Confirm `steel_bend_tracking.html` loads all rows automatically.
- Confirm group, plant, item, and status filters work.
- Confirm Pending rows appear above Sent/Done rows.
- Confirm horizontal scrolling works on mobile.
- Publish the updated static files to GitHub Pages or the current SharePoint/GitHub deployment location.

Suggested commit message:

```text
Prepare steel bend app for daily cutoff status workflow
```
