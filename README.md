# Steel Bending Order System - Tata Steel Thailand

เอกสารนี้สรุประบบสั่งพับเหล็กปัจจุบัน และแนวทางเตรียมระบบสำหรับ daily 10:00 cutoff, PDF generation และ factory notification โดยไม่แก้ Power Automate โดยตรงจากฝั่ง frontend

## Current System Overview

- Frontend: HTML + Vanilla JavaScript
- Hosting: GitHub Pages / static hosting
- Backend: Power Automate HTTP trigger flows
- Database: Excel file on SharePoint (`Input_DB.xlsx`)
- Main Excel table: `InputDB`
- Main pages:
  - `index.html` - login / entry page
  - `steel_bend_order.html` - order submission form
  - `steel_bend_tracking.html` - order tracking page

Current order submission works by sending one HTTP POST payload per item to Power Automate. Power Automate writes each payload into the Excel table.

## Order Payload Mapping

`steel_bend_order.html` sends these fields:

| Payload field | Source in frontend | Excel column / usage |
| --- | --- | --- |
| `OrderID` | generated per item | `OrderID` |
| `order_id` | generated per item | compatibility key for `OrderID` |
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
| `Status_Text` | constant `Pending` | future `Status_Text` compatibility key |

Backward-compatible aliases currently kept in the payload:

- `remark` mirrors `incoterms` for older flows that previously used `remark` as Incoterms.
- `receive_date` and `request_date` mirror the receive date input if a future Excel/flow mapping supports it.

## Power Automate Order Submit Flow Update

Existing order submission flow should continue using the same HTTP trigger and the same `Input_DB.xlsx` file.

In the Excel action that adds a row:

- File: `Input_DB.xlsx`
- Table: `InputDB`

Required mapping for current fields:

| Excel column | Recommended Power Automate value |
| --- | --- |
| `Date` | `triggerBody()?['date']` |
| `Plant` | `triggerBody()?['plant']` |
| `Item Description` | `triggerBody()?['item_description']` |
| `Customer Group` | `triggerBody()?['customer_group']` |
| `Tons` | `triggerBody()?['tons']` |
| `Pcs` | `triggerBody()?['pcs']` |
| `Sales Order No.` | `triggerBody()?['sales_order_no']` |
| `Customer Name` | `triggerBody()?['customer_name']` |
| `Sales Person` | `triggerBody()?['sales_person']` |
| `Incoterms` | `triggerBody()?['incoterms']` |
| `Order Remark` | `triggerBody()?['order_remark']` |
| `Unit Weight` | `triggerBody()?['unit_weight']` |
| `Status` | `false` |
| `submitter_email` | `triggerBody()?['submitter_email']` |
| `OrderID` | `coalesce(triggerBody()?['OrderID'], triggerBody()?['order_id'])` |
| `Status_Text` | `coalesce(triggerBody()?['Status_Text'], triggerBody()?['status_text'], 'Pending')` |

After updating the flow, submit one test order and confirm the new Excel row has:

- `Status` = `FALSE`
- `Status_Text` = `Pending`
- `Incoterms` from the selected incoterm dropdown
- `Order Remark` from the remark input
- `Unit Weight` from frontend material lookup

## Excel Column Mapping

Current `Input_DB.xlsx` input table `InputDB` columns:

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

1. List rows from `Input_DB.xlsx`, table `InputDB`.
2. Filter rows where:
   - `Status_Text` = `Pending`
   - `Plant` = `SCSC`
3. Generate `Batch_ID`, for example `SCSC-YYYYMMDD-1000`.
4. Write selected rows into `SCSC_Batch_Input`.
5. Generate PDF from the SCSC form template.
6. Save the PDF to SharePoint.
7. Send email to the SCSC factory with the PDF/link.
8. If email succeeds, update selected `Input_DB.xlsx` rows in table `InputDB`:
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

Implementation notes for filtering:

- Prefer filtering in Power Automate after `List rows` with a Filter array action first.
- Use normalized comparison if older rows may have blank `Status_Text`:

```text
equals(toLower(trim(item()?['Status_Text'])), 'pending')
```

- For plant:

```text
equals(item()?['Plant'], 'SCSC')
```

- For a combined advanced mode filter expression:

```text
and(
  equals(toLower(trim(item()?['Status_Text'])), 'pending'),
  equals(item()?['Plant'], 'SCSC')
)
```

Recommended update-row key:

- Use `OrderID` as the update key after the order submit flow maps it into the `OrderID` Excel column.
- Keep `OrderID` unique per item row. The frontend sends one generated `OrderID` for each item payload.

## Power Automate Flow 5 Detailed Runbook

Build the first version for SCSC only. After it works, duplicate the plant/template branch for NTS.

### 1. Create Scheduled Cloud Flow

Create a new Scheduled cloud flow:

- Flow name: `Steel_Bend_05_DailyCutoffPDF`
- Starting: next working test date/time
- Repeat every: `1` day

Open the Recurrence trigger and set:

- Interval: `1`
- Frequency: `Day`
- Time zone: `SE Asia Standard Time`
- At these hours: `10`
- At these minutes: `0`

For testing, temporarily set the recurrence to a near future time or use manual Test after saving.

### 2. Initialize Variables

Add these variables immediately after Recurrence:

| Action | Name | Type | Value |
| --- | --- | --- | --- |
| Initialize variable | `PlantCode` | String | `SCSC` |
| Initialize variable | `RunDateText` | String | `formatDateTime(convertTimeZone(utcNow(),'UTC','SE Asia Standard Time'),'yyyyMMdd')` |
| Initialize variable | `CutoffDate` | String | `formatDateTime(convertTimeZone(utcNow(),'UTC','SE Asia Standard Time'),'yyyy-MM-dd')` |
| Initialize variable | `SentAt` | String | `formatDateTime(convertTimeZone(utcNow(),'UTC','SE Asia Standard Time'),'yyyy-MM-dd HH:mm:ss')` |
| Initialize variable | `BatchID` | String | `concat(variables('PlantCode'),'-',variables('RunDateText'),'-1000')` |
| Initialize variable | `PdfFileName` | String | `concat(variables('BatchID'),'.pdf')` |

### 3. List Pending Rows

Add action: Excel Online (Business) - List rows present in a table

- Location: SharePoint site used by `Input_DB.xlsx`
- Document Library: the library that contains the workbook
- File: `Input_DB.xlsx`
- Table: `InputDB`

Turn on pagination if available. This keeps the flow ready if rows exceed the default connector page size.

### 4. Filter Pending SCSC Rows

Add action: Data Operations - Filter array

From:

```text
value from List rows present in a table
```

Advanced mode expression:

```text
@and(
  equals(toLower(trim(coalesce(item()?['Status_Text'], ''))), 'pending'),
  equals(item()?['Plant'], variables('PlantCode'))
)
```

Name this action: `Filter_Pending_SCSC`.

### 5. Stop If No Pending Rows

Add Condition:

```text
length(body('Filter_Pending_SCSC'))
```

is greater than

```text
0
```

If No:

- Add Terminate
- Status: Succeeded
- Message: `No pending SCSC orders for cutoff`

If Yes: continue.

### 6. Prepare Batch Input

Recommended structure:

- Create or use a separate Excel table named `SCSC_Batch_Input`.
- Clear old rows before writing the new batch if this table feeds the PDF template.
- Add each filtered row into `SCSC_Batch_Input`.

Inside Apply to each over `body('Filter_Pending_SCSC')`, map at minimum:

| SCSC batch field | Value |
| --- | --- |
| `Batch_ID` | `variables('BatchID')` |
| `OrderID` | `items('Apply_to_each')?['OrderID']` |
| `Date` | `items('Apply_to_each')?['Date']` |
| `Plant` | `items('Apply_to_each')?['Plant']` |
| `Item Description` | `items('Apply_to_each')?['Item Description']` |
| `Customer Group` | `items('Apply_to_each')?['Customer Group']` |
| `Tons` | `items('Apply_to_each')?['Tons']` |
| `Pcs` | `items('Apply_to_each')?['Pcs']` |
| `Customer Name` | `items('Apply_to_each')?['Customer Name']` |
| `Sales Person` | `items('Apply_to_each')?['Sales Person']` |
| `Incoterms` | `items('Apply_to_each')?['Incoterms']` |
| `Order Remark` | `items('Apply_to_each')?['Order Remark']` |
| `Unit Weight` | `items('Apply_to_each')?['Unit Weight']` |

If clearing `SCSC_Batch_Input` is awkward with the Excel connector, use an Office Script later. For the first version, writing a new batch table or appending with `Batch_ID` is acceptable.

### 7. Generate PDF

Choose one implementation path:

Option A - Excel template to PDF:

1. Store the SCSC form template in SharePoint.
2. Fill `SCSC_Batch_Input`.
3. Use the Excel/OneDrive/SharePoint conversion action available in your tenant to create PDF from the template/workbook.
4. Save the generated PDF into a SharePoint folder.

Option B - Word template to PDF:

1. Create a Word template with repeating table rows if your license supports Word template population.
2. Populate the template with filtered rows.
3. Convert Word document to PDF.
4. Save the PDF to SharePoint.

Recommended SharePoint folder:

```text
SCM Demand/SCM Demand/เหล็กพับ/CutoffPDF/SCSC/
```

Recommended file name:

```text
SCSC-YYYYMMDD-1000.pdf
```

### 8. Send Email To Factory

Add action: Send an email (V2)

Suggested fields:

- To: SCSC factory email group
- Subject: `Steel Bending Cutoff - SCSC - @{variables('CutoffDate')} 10:00`
- Attachment: generated PDF
- Body should include:
  - Batch ID
  - Cutoff date/time
  - Number of rows
  - PDF link

Row count expression:

```text
length(body('Filter_Pending_SCSC'))
```

### 9. Update InputDB Rows After Email Success

Use Apply to each over `body('Filter_Pending_SCSC')`.

Action: Excel Online (Business) - Update a row

- File: `Input_DB.xlsx`
- Table: `InputDB`
- Key Column: `OrderID`
- Key Value: `items('Apply_to_each')?['OrderID']`

Set these fields:

| Excel column | Value |
| --- | --- |
| `Status` | `true` |
| `Status_Text` | `Sent` |
| `Cutoff_Batch_ID` | `variables('BatchID')` |
| `Cutoff_Date` | `variables('CutoffDate')` |
| `Sent_To_Plant_At` | `variables('SentAt')` |
| `PDF_File_Name` | `variables('PdfFileName')` |
| `PDF_File_URL` | link/path returned by create file action |
| `Error_Message` | blank |

Keep all existing fields mapped to their current values if the Update row action requires them. Do not overwrite order data with blank values.

### 10. Error Handling Scope

Recommended structure:

- Scope: `Try_Cutoff`
  - List rows
  - Filter rows
  - Generate PDF
  - Send email
  - Update rows as Sent
- Scope: `Catch_Error`
  - Configure run after `Try_Cutoff` has failed, timed out, or skipped
  - Apply to each filtered pending row if available
  - Update:
    - `Status_Text` = `Error`
    - `Error_Message` = error summary

Useful error message expression:

```text
string(outputs('Try_Cutoff'))
```

If `Filter_Pending_SCSC` did not run, send an admin email instead of updating rows.

### 11. Test Plan

Test with 1-2 rows only:

1. Submit one SCSC test order from the web app.
2. Confirm Excel row has:
   - `OrderID` not blank
   - `Status` unchecked / false
   - `Status_Text` = `Pending`
3. Run Flow 5 manually.
4. Confirm PDF file is created.
5. Confirm email is sent.
6. Confirm the same InputDB row changed to:
   - `Status` checked / true
   - `Status_Text` = `Sent`
   - `Cutoff_Batch_ID` = `SCSC-YYYYMMDD-1000`
   - `PDF_File_Name` and `PDF_File_URL` filled
7. Open tracking page and confirm row no longer appears as Pending.

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
