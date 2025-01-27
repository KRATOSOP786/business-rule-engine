const sendWhatsAppMessage = (to, message) => {
    const twilio = require('twilio');
    const accountSid = 'YOUR_TWILIO_ACCOUNT_SID';
    const authToken = 'YOUR_TWILIO_AUTH_TOKEN'; 
    const client = new twilio(accountSid, authToken);

    client.messages.create({
        from: 'whatsapp:+14155238886', 
        to: `whatsapp:${to}`,
        body: message,
    })
    .then((message) => console.log('WhatsApp message sent:', message.sid))
    .catch((error) => console.error('Error sending WhatsApp message:', error));
};

module.exports = {sendWhatsAppMessage};