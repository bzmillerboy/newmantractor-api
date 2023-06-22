const {
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
  PORTAL_URL,
} = process.env;

const sgMail = require("@sendgrid/mail");

const sendFinanceApplicationEmail = async (
  activityName,
  application,
  activityMetaData
) => {
  sgMail.setApiKey(SENDGRID_API_KEY);

  // Extract data from application fetch
  const { contact, type, application_id } = application;
  const { first_name, last_name, email: contactEmail } = contact;
  const { id: typeId } = type;

  // Set variables based on application type and activity name
  let templateId = "";
  let toEmail = "";
  let subject = "";
  let fromEmail = "";
  let fromName = "";
  let replyToEmail = "";
  let bccEmail = "";
  let fromFirstName = "";
  let fromLastName = "";
  let fromPhone = "";
  let ctaButtonText = "";
  let ctaButtonLink = "";
  let fromImage = "";
  let fromJobTitle = "";
  const setVariables = async () => {
    if (activityName === "application submitted" && typeId === 1) {
      templateId = "d-8e9c9cf1077b4278a413f33c68a7bdca";
      toEmail = contactEmail;
      subject = `Financing Application Submitted | Ref #${application.application_id} | Newman Tractor`;
      fromEmail = "notifications+matt@newmantractor.com";
      fromName = "Matt Salyers";
      replyToEmail = "notifications+matt@newmantractor.com";
      bccEmail = "finance@newmantractor.com";
      fromFirstName = "Matt";
      fromLastName = "Salyers";
      fromPhone = "(859) 393-5405";
      fromJobTitle = "Finance Manager";
      fromImage =
        "https://cdn.sanity.io/images/agnoplrn/production/73629f66aaedcf2e9cd482f077520d6af2fe5bc2-3522x3522.jpg?w=600&h=480&q=75&auto=format&fit=crop";
      ctaButtonLink = `${PORTAL_URL}/my-applications`;
      ctaButtonText = "VIEW MY APPLICATION";
    } else if (activityName === "application submitted" && typeId === 2) {
      templateId = "d-8e9c9cf1077b4278a413f33c68a7bdca";
      toEmail = contactEmail;
      subject = `Financing Application Submitted | Ref #${application.application_id} | Newman Tractor`;
      fromEmail = "notifications+caroll@newmantractor.com";
      fromName = "Caroll Smith";
      replyToEmail = "notifications+caroll@newmantractor.com";
      bccEmail = "credit@newmantractor.com";
      fromFirstName = "Caroll";
      fromLastName = "Smith";
      fromPhone = "(859) 802-5298";
      fromJobTitle = "Credit Manager";
      fromImage =
        "https://cdn.sanity.io/images/agnoplrn/production/3d170bc7cf16b0fb8f7d9095fbece08f5bba1266-3310x3310.jpg?w=600&h=480&q=75&auto=format&fit=crop";
      ctaButtonLink = `${PORTAL_URL}/my-applications`;
      ctaButtonText = "VIEW MY APPLICATION";
    } else if (activityName === "send to lender") {
      //TODO: include notes in email
      //TODO: update to new template id
      templateId = "d-8f19bf394e2c4c518636551836b346d9";
      toEmail = activityMetaData?.lender_email;
      subject = `Financing Application Under Lender Review | Ref #${application.application_id} | Newman Tractor`;
      fromEmail = "notifications+matt@newmantractor.com";
      fromName = "Matt Salyers";
      replyToEmail = "notifications+matt@newmantractor.com";
      bccEmail = "finance@newmantractor.com";
      fromFirstName = "Matt";
      fromLastName = "Salyers";
      fromPhone = "(859) 393-5405";
      fromJobTitle = "Finance Manager";
      fromImage =
        "https://cdn.sanity.io/images/agnoplrn/production/73629f66aaedcf2e9cd482f077520d6af2fe5bc2-3522x3522.jpg?w=600&h=480&q=75&auto=format&fit=crop";
      ctaButtonLink = `${PORTAL_URL}/my-applications`;
      ctaButtonText = "VIEW MY APPLICATION";
    } else if (activityName === "sent to lender") {
      //TODO: include notes in email
      templateId = "d-8f19bf394e2c4c518636551836b346d9";
      toEmail = contactEmail;
      subject = `Financing Application Under Lender Review | Ref #${application.application_id} | Newman Tractor`;
      fromEmail = "notifications+matt@newmantractor.com";
      fromName = "Matt Salyers";
      replyToEmail = "notifications+matt@newmantractor.com";
      bccEmail = "finance@newmantractor.com";
      fromFirstName = "Matt";
      fromLastName = "Salyers";
      fromPhone = "(859) 393-5405";
      fromJobTitle = "Finance Manager";
      fromImage =
        "https://cdn.sanity.io/images/agnoplrn/production/73629f66aaedcf2e9cd482f077520d6af2fe5bc2-3522x3522.jpg?w=600&h=480&q=75&auto=format&fit=crop";
      ctaButtonLink = `${PORTAL_URL}/my-applications`;
      ctaButtonText = "VIEW MY APPLICATION";
    }
  };

  await setVariables();

  const msg = {
    to: toEmail,
    from: {
      email: fromEmail || SENDGRID_FROM_EMAIL,
      name: fromName || SENDGRID_FROM_NAME,
    },
    replyTo: replyToEmail || SENDGRID_FROM_EMAIL,
    // TODO: uncomment when ready for prod
    // bcc: [bccEmail],
    subject: subject,
    templateId: templateId,
    dynamic_template_data: {
      email: toEmail,
      firstName: first_name,
      lastName: last_name,
      applicationId: application.application_id,
      fromImage: fromImage,
      fromPhone: fromPhone,
      fromFirstName: fromFirstName,
      fromLastName: fromLastName,
      fromPhone: fromPhone,
      fromEmail: fromEmail,
      fromJobTitle: fromJobTitle,
      typeId: typeId,
      applicationId: application_id,
      ctaButtonText: ctaButtonText,
      ctaButtonLink: ctaButtonLink,
    },
  };

  console.log("msg:", JSON.stringify(msg));

  await sgMail.send(msg);
};

module.exports = {
  sendFinanceApplicationEmail,
};
