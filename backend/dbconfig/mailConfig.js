const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: 'asad.artiset@gmail.com', 
        pass: 'Asad@11sept',  
    },
});


const mailOptions = {
    from: 'asad.artiset@gmail.com',
    to: 'pangarkarasad1@gmail.com',  
    subject: 'Test Email',  
    text: 'Please upload your resume via profile',
    html: '<h1>Hello</h1><p>This is a test email!</p>'
};


transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.error('Error sending email:', error);
    }
    console.log('Email sent successfully:', info.response);
});
