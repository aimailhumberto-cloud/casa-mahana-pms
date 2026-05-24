console.log('PAYPAL_CLIENT_ID defined:', !!process.env.PAYPAL_CLIENT_ID);
if (process.env.PAYPAL_CLIENT_ID) {
  console.log('PAYPAL_CLIENT_ID length:', process.env.PAYPAL_CLIENT_ID.length);
  console.log('PAYPAL_CLIENT_ID starts with:', process.env.PAYPAL_CLIENT_ID.substring(0, 5));
}
console.log('PAYPAL_CLIENT_SECRET defined:', !!process.env.PAYPAL_CLIENT_SECRET);
console.log('PAYPAL_MODE defined:', !!process.env.PAYPAL_MODE);
if (process.env.PAYPAL_MODE) {
  console.log('PAYPAL_MODE value:', process.env.PAYPAL_MODE);
}
