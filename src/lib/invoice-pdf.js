// Generates and downloads an invoice PDF for the given order via jsPDF.
// Returns a promise that resolves once the file save is triggered.
export async function downloadInvoicePdf(order) {
  if (!order) throw new Error("Order is required");

  const { default: jsPDF } = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  const autoTable = autoTableMod.default ?? autoTableMod.autoTable;

  // Safe base64 encoder for large ArrayBuffers (avoids call-stack overflow)
  const toBase64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  // Detect Arabic/RTL characters
  const isArabic = (str) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(String(str ?? ""));

  // Load Cairo font (supports Arabic + Latin) and logo in parallel
  const [regularBuf, boldBuf, logoBuf] = await Promise.all([
    fetch("/fonts/Cairo-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/Cairo-Bold.ttf").then((r) => r.arrayBuffer()),
    fetch("/images/shop-logo-darck.png").then((r) => r.arrayBuffer()).catch(() => null),
  ]);

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

  // Embed Cairo font so Arabic glyphs render correctly
  doc.addFileToVFS("Cairo-Regular.ttf", toBase64(regularBuf));
  doc.addFont("Cairo-Regular.ttf", "Cairo", "normal");
  doc.addFileToVFS("Cairo-Bold.ttf", toBase64(boldBuf));
  doc.addFont("Cairo-Bold.ttf", "Cairo", "bold");

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // ── Header: INVOICE (left) | DATE (right) ─────────────────────────────
  doc.setFont("Cairo", "bold");
  doc.setFontSize(26);
  doc.setTextColor(24, 24, 27);
  doc.text("INVOICE", margin, 24);

  doc.setFont("Cairo", "normal");
  doc.setFontSize(10);
  doc.setTextColor(113, 113, 122);
  doc.text(`#${shortId}`, margin, 31);

  // Date block — top-right
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text("DATE", pageW - margin, 18, { align: "right" });
  doc.setFont("Cairo", "bold");
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text(dateStr, pageW - margin, 24, { align: "right" });
  doc.setFont("Cairo", "normal");
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text(timeStr, pageW - margin, 30, { align: "right" });

  const dividerY = 38;
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.3);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  // ── Customer info ────────────────────────────────────────────────────────
  let y = dividerY + 10;
  doc.setFont("Cairo", "bold");
  doc.setFontSize(9);
  doc.setTextColor(161, 161, 170);
  doc.text("BILLED TO", margin, y);
  doc.text("SHIPPING ADDRESS", pageW / 2, y);

  y += 6;
  doc.setFont("Cairo", "bold");
  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  doc.text(ship.full_name || "Guest", margin, y);

  doc.setFont("Cairo", "normal");
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

  // ── Items table ──────────────────────────────────────────────────────────
  const tableStartY = y + Math.max(addressLines.length * 5, 10) + 8;
  const body = items.map((it) => {
    const unit = Number(it.unit_price) * rate;
    const sub = unit * it.quantity;
    const baseName = it.products?.name ?? "Product";
    const variantParts = [];
    if (it.selected_color?.name) variantParts.push(`Color: ${it.selected_color.name}`);
    if (it.selected_size)        variantParts.push(`Size: ${it.selected_size}`);
    const name = variantParts.length
      ? `${baseName}\n${variantParts.join('  •  ')}`
      : baseName;
    return [
      name,
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
    styles: { font: "Cairo", fontSize: 10, cellPadding: 3, textColor: [39, 39, 42] },
    headStyles: {
      font: "Cairo",
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
    // Right-align Arabic product names
    didParseCell: (data) => {
      if (data.column.index === 0 && isArabic(data.cell.raw)) {
        data.cell.styles.halign = "right";
      }
    },
    margin: { left: margin, right: margin },
  });

  // ── Total ────────────────────────────────────────────────────────────────
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setDrawColor(228, 228, 231);
  doc.line(pageW - margin - 70, finalY, pageW - margin, finalY);

  doc.setFont("Cairo", "normal");
  doc.setFontSize(10);
  doc.setTextColor(113, 113, 122);
  doc.text("TOTAL", pageW - margin - 70, finalY + 7);

  doc.setFont("Cairo", "bold");
  doc.setFontSize(14);
  doc.setTextColor(24, 24, 27);
  doc.text(
    `${(Number(order.total_amount) * rate).toFixed(2)} ${currency}`,
    pageW - margin,
    finalY + 7,
    { align: "right" }
  );

  doc.setFont("Cairo", "normal");
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text("STATUS", pageW - margin - 70, finalY + 13);
  doc.text(String(order.status).toUpperCase(), pageW - margin, finalY + 13, { align: "right" });

  // ── Footer: logo centered + thank-you text ─────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  const logoH = 10;
  const logoW = logoH * 4;
  if (logoBuf) {
    doc.addImage(
      toBase64(logoBuf), "PNG",
      (pageW - logoW) / 2, pageH - 24,
      logoW, logoH
    );
  }
  doc.setFont("Cairo", "normal");
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text("Thank you for your purchase!", pageW / 2, pageH - 10, { align: "center" });

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
