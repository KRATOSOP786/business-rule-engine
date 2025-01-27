const { EmailClient } = require("@azure/communication-email");
require('dotenv').config();
const connectionString = process.env.AZURE_EMAIL_STRING; 
const emailClient = new EmailClient(connectionString);

const sendEmail = async (toEmail, subject, body,) => {
    const emailMessage = {
        senderAddress: process.env.SENDER_EMAIL,
        content: {
            subject: subject,
            plainText: body, // set email body
        },
        recipients: {
            to: [{ address: toEmail }],
        },
    };

    try {
        const poller = await emailClient.beginSend(emailMessage);
        await poller.pollUntilDone();
        console.log(`Email sent successfully to ${toEmail}`);
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

module.exports = {sendEmail};
