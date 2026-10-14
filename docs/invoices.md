# Invoices

Standard and assessment invoices share `invoices` and `invoice_line_items`. Every invoice is assumed to be paid: Tempus does not record invoice payments, and invoice income counts on its invoice date (see [bas-and-tax.md](bas-and-tax.md)).

Document states:

- `draft`: editable and explicitly recalculable.
- `issued`: numbered and immutable.
- `sent`: immutable with a send timestamp.
- `void`: retained as audit history.

Server-side numbering occurs only under the script lock. Issuing snapshots line amount, GST, source metadata, and the relevant entry details. Reads do not recalculate or mutate invoices.

Corrections use void-and-revise. A revision copies the historical lines into a new draft and links back to the source invoice. Assessment sources are released only when their invoice is voided. Legacy `generated` invoices become issued.
