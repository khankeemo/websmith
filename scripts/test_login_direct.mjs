async function testLogin() {
  const resp = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'digitalwebsmith@gmail.com', password: 'Khan@8383' })
  });
  console.log('Login Status:', resp.status);
  const data = await resp.json();
  console.log('Login Response Data:', data);
}
testLogin();
