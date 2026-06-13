// Replicate the exact functions from email-handler.js

function decodeQP(str) {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// NEW decodeBody QP branch
function decodeBodyNew(body, charset) {
  const cs = charset || "utf-8";
  const toText = (bytes) => {
    try { return new TextDecoder(cs).decode(bytes); }
    catch { try { return new TextDecoder("utf-8").decode(bytes); } catch { return null; } }
  };
  const decoded = decodeQP(body); // string cu bytes 0-255
  const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0) & 0xff);
  return toText(bytes) ?? decoded;
}

// OLD behavior (per finding: "return decodeQP(body)")
function decodeBodyOld(body) {
  return decodeQP(body);
}

// ---- SIMULATION ----
// Step 1: A real email arrives. The raw bytes contain a QP-encoded text part.
// Per email-handler line 74: rawEmail = await new Response(message.raw).text()
// => the ENTIRE raw email is decoded as UTF-8.
//
// The finding's scenario: a webmail declares QP but leaves some Romanian letters
// as LITERAL UTF-8 bytes (not =XX encoded). Build the raw bytes for such a body.

// Body the sender intended: "Pâ=C3=AEine și î"  (mixing =XX for some chars and literal UTF-8 for ș)
// Let's construct raw bytes: literal "â" as... wait, â is also written as =C3=A2 normally.
// Per finding example: body QP text = 'Pâ=C3=AEine și î'
// Here 'â' and 'ș' and 'î' (the last) are LITERAL multi-byte UTF-8 in the raw stream,
// while =C3=AE is an encoded 'î'.

const intendedBodyChars = "Pâ=C3=AEine și î";

// The raw email stream is bytes. Response.text() decodes those bytes as UTF-8.
// So literal 'â','ș','î' in the wire are UTF-8 byte sequences; after Response.text()
// they become proper JS string code points (â=U+00E2, ș=U+0219, î=U+00EE).
// The =C3=AE stays as literal ASCII chars '=','C','3','=','A','E'.

// Simulate: the JS string that decodeBody receives (post Response.text()) is exactly:
const bodyAfterResponseText = intendedBodyChars; // already proper Unicode string

console.log("Input body (post Response.text):", JSON.stringify(bodyAfterResponseText));
console.log("Code points:", [...bodyAfterResponseText].map(c => c.codePointAt(0).toString(16)).join(" "));

const outNew = decodeBodyNew(bodyAfterResponseText, "utf-8");
const outOld = decodeBodyOld(bodyAfterResponseText);

console.log("\n--- NEW (current code, with & 0xff) ---");
console.log(JSON.stringify(outNew));
console.log("Code points:", [...outNew].map(c => c.codePointAt(0).toString(16)).join(" "));

console.log("\n--- OLD (return decodeQP(body)) ---");
console.log(JSON.stringify(outOld));
console.log("Code points:", [...outOld].map(c => c.codePointAt(0).toString(16)).join(" "));

console.log("\nIntended human-readable: 'Pâîine și î'");
