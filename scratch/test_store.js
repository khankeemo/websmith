const http = require('http');

http.get('http://localhost:3000/software-store', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Contains Search software...:', data.includes('Search software...'));
    console.log('Contains Software Marketplace badge:', data.includes('Software Marketplace'));
    console.log('Contains CartPanel or ShoppingCart:', data.includes('cart') || data.includes('Cart'));
    console.log('Contains dark-theme / light-theme:', data.includes('dark-theme') || data.includes('light-theme'));
  });
}).on('error', (err) => {
  console.error('Error fetching page:', err.message);
});
