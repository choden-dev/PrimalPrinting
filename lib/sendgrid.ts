import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmailBankTransfer = async (
    email: string,
    name: string,
    orderId: string,
    items: string,
    price: string
): Promise<boolean> => {
    const msg = {
        to: email, // Change to your recipient
        from: "primalprintingnz@gmail.com", // Change to your verified sender
        templateId: process.env.BANK_TEMPLATE,
        dynamicTemplateData: {
            orderId: orderId,
            name: name,
            items: items,
            price: price,
        },
    };
    sgMail
        .send(msg)
        .then(() => {
            console.log("Email sent");
            return Promise.resolve(true);
        })
        .catch((error) => {
            console.error(error.response.body.errors);
            return Promise.resolve(false);
        });
};

export const sendEmailStripePayment = async (
    email: string,
    name: string,
    orderId: string,
    price: string
): Promise<boolean> => {
    const msg = {
        to: email, // Change to your recipient
        from: "primalprintingnz@gmail.com", // Change to your verified sender
        templateId: process.env.STRIPE_TEMPLATE,
        dynamicTemplateData: {
            orderId: orderId,
            name: name,
            price: price,
        },
    };
    sgMail
        .send(msg)
        .then(() => {
            console.log("Email sent");
            return Promise.resolve(true);
        })
        .catch((error) => {
            console.error(error.response.body.errors);
            return Promise.resolve(false);
        });
};
