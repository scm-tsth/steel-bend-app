# Steel Bend Sales Master API (Power Automate)

Flow name: `Steel_Bend_06_SalesMasterAPI`

## Purpose

Read the SharePoint Excel table `tData` for the steel bending order page without exposing phone numbers or coordinator data.

The web app accepts only:

- `Customer`
- `Sales`
- `Department`
- `Active`

Rules:

- include only `Active = TRUE`
- exclude `Department = CAB`
- exclude blank Customer/Sales/Department rows
- never return telephone or coordinator columns

## Power Automate actions

### 1. Trigger

Create an **Instant cloud flow** with **When an HTTP request is received**.

Request body schema:

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string"
    }
  }
}
```

### 2. Excel Online (Business): List rows present in a table

- Location: SharePoint Site
- Site: `https://tatasteelthailand.sharepoint.com/sites/SCM-FileShare`
- File: select `Customer_Sales_Contact Updated 15.06.2026.xlsx`
- Table: `tData`
- Turn on pagination; threshold 5000

### 3. Filter array

From:

```text
body('List_rows_present_in_a_table')?['value']
```

Advanced mode:

```text
@and(
  equals(toLower(trim(string(item()?['Active']))), 'true'),
  not(equals(toUpper(trim(string(item()?['Department']))), 'CAB')),
  not(empty(trim(string(item()?['Customer'])))),
  not(empty(trim(string(item()?['Sales'])))),
  not(empty(trim(string(item()?['Department']))))
)
```

### 4. Select

From:

```text
body('Filter_array')
```

Map only:

| Key | Value |
|---|---|
| customer | `item()?['Customer']` |
| sales | `item()?['Sales']` |
| department | `item()?['Department']` |
| active | `item()?['Active']` |

### 5. Response

- Status code: `200`
- Header `Content-Type`: `application/json`
- Header `Cache-Control`: `no-store`
- Body: `body('Select')`

Save the flow, copy its HTTP POST URL, and set it as `SALES_MASTER_URL` in `steel_bend_order.html`.

## Expected test

A successful response is a JSON array:

```json
[
  {
    "customer": "บจก.วุฒิชัยสตีล",
    "sales": "คุณธิติรัตน์ (นัตตี้)",
    "department": "Direct",
    "active": true
  }
]
```

The order page performs the same Active/CAB filtering again as a safety check and falls back to embedded data if this API is unavailable.
