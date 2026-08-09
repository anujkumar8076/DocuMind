async function testChat() {
  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: "Summarize Anuj Kumar's technical skills, experience, and projects in detail.",
      documentIds: ['cmsm4rtj400076h095upbjxob'],
    }),
  });

  const text = await res.text();
  console.log('\n--- CHAT RESPONSE ---');
  console.log(text);
  console.log('---------------------\n');
}

testChat().catch(console.error);
