import { normalizePhone } from "@/lib/phone";

export type ParsedContactRow = {
  line: number;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  roles: string[];
  tags: string[];
  portfolioUrl: string | null;
  instagramUrl: string | null;
  notes: string | null;
};

export type ContactCsvParseResult = {
  contacts: ParsedContactRow[];
  errors: string[];
};

const expectedHeaders = [
  "name",
  "phone",
  "email",
  "city",
  "roles",
  "tags",
  "portfoliourl",
  "instagramurl",
  "notes",
];

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function listCell(value: string | undefined) {
  return (value || "")
    .split(/[,|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parseContactCsv(csv: string): ContactCsvParseResult {
  const errors: string[] = [];
  const rows = csv
    .split(/\r?\n/)
    .map((row, index) => ({ text: row.trim(), line: index + 1 }))
    .filter((row) => row.text);

  if (rows.length === 0) return { contacts: [], errors };

  const firstCells = splitCsvLine(rows[0].text).map((cell) =>
    cell.toLowerCase().replace(/\s+/g, ""),
  );
  const hasHeader =
    firstCells.length >= 2 &&
    firstCells[0] === "name" &&
    firstCells[1] === "phone";
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (
    hasHeader &&
    firstCells.some((header, index) => header && header !== expectedHeaders[index])
  ) {
    errors.push(
      `Header should be: ${expectedHeaders
        .map((header) =>
          header === "portfoliourl"
            ? "portfolioUrl"
            : header === "instagramurl"
              ? "instagramUrl"
              : header,
        )
        .join(", ")}`,
    );
  }

  const contacts = dataRows.flatMap((row) => {
    const cells = splitCsvLine(row.text);
    const [name, phone, email, city, roles, tags, portfolioUrl, instagramUrl, notes] =
      cells;

    if (!name || !phone) {
      errors.push(`Line ${row.line}: name and phone are required.`);
      return [];
    }

    let normalizedPhone = "";
    try {
      normalizedPhone = normalizePhone(phone);
    } catch {
      errors.push(`Line ${row.line}: invalid phone number.`);
      return [];
    }

    return [
      {
        line: row.line,
        name,
        phone: normalizedPhone,
        email: emptyToNull(email),
        city: emptyToNull(city),
        roles: listCell(roles),
        tags: listCell(tags),
        portfolioUrl: emptyToNull(portfolioUrl),
        instagramUrl: emptyToNull(instagramUrl),
        notes: emptyToNull(notes),
      },
    ];
  });

  const seen = new Set<string>();
  for (const contact of contacts) {
    if (seen.has(contact.phone)) {
      errors.push(`Line ${contact.line}: duplicate phone in pasted CSV.`);
    }
    seen.add(contact.phone);
  }

  return { contacts, errors };
}
