// Test R2 fetch direct cu credentials
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const accountId = "998276877f06ec89b465c40c309e89fc";
const accessKeyId = "d53098accb435b1e0c6185eea00d5c18";
const secretAccessKey = "31e80af1fa5ee1562655b7c817199b689be9828e45e9f978f9c3a648574df8b5";
const bucket = "civia-inbox-attachments";

const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

console.log("Endpoint:", endpoint);

try {
  const listRes = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 20 }));
  console.log("\n=== Files in bucket ===");
  if (listRes.Contents) {
    for (const obj of listRes.Contents) {
      console.log(`  ${obj.Key} (${obj.Size} bytes, ${obj.LastModified})`);
    }
  } else {
    console.log("  (empty)");
  }
} catch (e) {
  console.error("LIST FAILED:", e.message);
}

try {
  const getRes = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: "attachments/2026-05-27/CAHTouhpRxmxBbYC-09af70e9-Scan_0001.pdf",
  }));
  const bytes = await getRes.Body.transformToByteArray();
  console.log(`\n=== GET specific file ===`);
  console.log(`  Got ${bytes.length} bytes`);
  console.log(`  First 8 bytes (hex): ${Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);
  console.log(`  First 8 bytes (ascii): ${new TextDecoder().decode(bytes.slice(0, 8))}`);
} catch (e) {
  console.error("\nGET FAILED:", e.message);
}
