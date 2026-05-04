// Generates and downloads an invoice PDF for the given order via jsPDF.
// Returns a promise that resolves once the file save is triggered.
export async function downloadInvoicePdf(order) {
  if (!order) throw new Error("Order is required");

  const { default: jsPDF } = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  const autoTable = autoTableMod.default ?? autoTableMod.autoTable;

  const ship = order.shipping_address ?? {};
  const items = order.order_items ?? [];
  const created = new Date(order.created_at);
  const dateStr = created.toLocaleDateString("en", {
    year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = created.toLocaleTimeString("en", {
    hour: "2-digit", minute: "2-digit",
  });
  const shortId = String(order.order_number ?? order.id.slice(0, 8).toUpperCase());
  const currency = order.currency_code ?? "MAD";
  const rate = Number(order.exchange_rate ?? 1);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(24, 24, 27);
  doc.text("INVOICE", margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(113, 113, 122);
  doc.text(`#${shortId}`, margin, 28);

  doc.setFontSize(9);
  doc.text("DATE", pageW - margin, 22, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text(dateStr, pageW - margin, 27, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text(timeStr, pageW - margin, 32, { align: "right" });

  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.3);
  doc.line(margin, 38, pageW - margin, 38);

  // Customer info
  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(161, 161, 170);
  doc.text("BILLED TO", margin, y);
  doc.text("SHIPPING ADDRESS", pageW / 2, y);

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  doc.text(ship.full_name || "Guest", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(82, 82, 91);
  const addressLines = [
    ship.address,
    [ship.city, ship.state].filter(Boolean).join(", "),
    [ship.zip, ship.country].filter(Boolean).join(" "),
  ].filter(Boolean);
  addressLines.forEach((line, i) => {
    doc.text(String(line), pageW / 2, y + i * 5);
  });

  if (ship.phone) {
    doc.text(String(ship.phone), margin, y + 5);
  }

  // Items table
  const tableStartY = y + Math.max(addressLines.length * 5, 10) + 8;
  const body = items.map((it) => {
    const unit = Number(it.unit_price) * rate;
    const sub = unit * it.quantity;
    return [
      it.products?.name ?? "Product",
      String(it.quantity),
      `${unit.toFixed(2)} ${currency}`,
      `${sub.toFixed(2)} ${currency}`,
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [["Item", "Qty", "Price", "Subtotal"]],
    body,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3, textColor: [39, 39, 42] },
    headStyles: {
      fillColor: [244, 244, 245],
      textColor: [82, 82, 91],
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 18 },
      2: { halign: "right", cellWidth: 35 },
      3: { halign: "right", cellWidth: 35, fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  // Total
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setDrawColor(228, 228, 231);
  doc.line(pageW - margin - 70, finalY, pageW - margin, finalY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(113, 113, 122);
  doc.text("TOTAL", pageW - margin - 70, finalY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(24, 24, 27);
  doc.text(
    `${(Number(order.total_amount) * rate).toFixed(2)} ${currency}`,
    pageW - margin,
    finalY + 7,
    { align: "right" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text("STATUS", pageW - margin - 70, finalY + 13);
  doc.text(String(order.status).toUpperCase(), pageW - margin, finalY + 13, { align: "right" });

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(161, 161, 170);
  doc.text(
    "Thank you for your purchase!",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 15,
    { align: "center" }
  );

  doc.save(`invoice-${shortId}.pdf`);
}

// Fetches order by id and triggers PDF download.
export async function downloadInvoiceById(orderId) {
  const res = await fetch(`/api/v1/orders/${orderId}`);
  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || "Order not found");
  }
  await downloadInvoicePdf(json.data);
}
