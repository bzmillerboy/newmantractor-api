const {
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
  PORTAL_URL,
} = process.env;
const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const sgMail = require("@sendgrid/mail");

const getFinanceApplicationEmailContent = async (emailNotificationId) => {
  const { data: emailNotification, error: emailNotificationError } =
    await supabase
      .from("email_notifications")
      .select(
        "template_id, subject, bcc, dynamic_content, from_contact: from_contact_id(first_name, last_name, email, phone, metadata)"
      )
      .eq("id", emailNotificationId)
      .single();
  if (emailNotificationError) {
    console.log("emailNotificationError:", emailNotificationError);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error retrieving email notifications data",
      }),
    };
  }
  console.log("emailNotification:", JSON.stringify(emailNotification));

  return emailNotification;
};

const sendFinanceApplicationEmail = async (activityRecord, application) => {
  sgMail.setApiKey(SENDGRID_API_KEY);

  const activityMetaData = activityRecord.metadata;
  const activityName = activityRecord.name;
  const activityNote = activityRecord.note_text;

  // Extract data from application fetch
  const { id: appId, contact, type, application_id } = application;
  const { first_name, last_name, email: contactEmail } = contact;
  const { id: typeId } = type;

  let emailNotificationId = "";
  let toEmail = "";
  let toFirstName = "";
  let toLastName = "";
  if (activityName === "application submitted" && typeId === 1) {
    emailNotificationId = 1;
    toEmail = contactEmail;
    toFirstName = first_name;
    toLastName = last_name;
  } else if (activityName === "application submitted" && typeId === 2) {
    emailNotificationId = 2;
    toEmail = contactEmail;
    toFirstName = first_name;
    toLastName = last_name;
  } else if (activityName === "send to lender") {
    emailNotificationId = 4;
    toEmail = activityMetaData?.lender_email;
    toFirstName = activityMetaData?.lender_first_name;
    toLastName = activityMetaData?.lender_last_name;
  } else if (activityName === "sent to lender") {
    emailNotificationId = 3;
    toEmail = contactEmail;
    toFirstName = first_name;
    toLastName = last_name;
  }

  const emailNotification = await getFinanceApplicationEmailContent(
    emailNotificationId
  );

  const {
    from_contact,
    template_id: templateId,
    subject,
    bcc,
    dynamic_content,
  } = emailNotification;

  const subjectEval = eval("`" + subject + "`");

  const {
    first_name: fromFirstName,
    last_name: fromLastName,
    email: fromEmail,
    phone: fromPhone,
    metadata,
  } = from_contact;
  const {
    emailSignatureJobTitle: fromJobTitle,
    emailSignatureProfilePicture: fromImage,
  } = metadata;

  // Set variables based on application type and activity name
  // const setVariables = async () => {
  //   if (activityName === "application submitted" && typeId === 1) {
  //     templateId = "d-8e9c9cf1077b4278a413f33c68a7bdca";
  //     toEmail = contactEmail;
  //     subject = `Financing Application Submitted | Ref #${application.application_id} | Newman Tractor`;
  //     fromEmail = "notifications+matt@newmantractor.com";
  //     fromName = "Matt Salyers";
  //     replyToEmail = "notifications+matt@newmantractor.com";
  //     bccEmail = "finance@newmantractor.com";
  //     fromFirstName = "Matt";
  //     fromLastName = "Salyers";
  //     fromPhone = "(859) 393-5405";
  //     fromJobTitle = "Finance Manager";
  //     fromImage =
  //       "https://cdn.sanity.io/images/agnoplrn/production/73629f66aaedcf2e9cd482f077520d6af2fe5bc2-3522x3522.jpg?w=600&h=480&q=75&auto=format&fit=crop";
  //     ctaButtonLink = `${PORTAL_URL}/my-applications`;
  //     ctaButtonText = "VIEW MY APPLICATION";
  //   } else if (activityName === "application submitted" && typeId === 2) {
  //     templateId = "d-8e9c9cf1077b4278a413f33c68a7bdca";
  //     toEmail = contactEmail;
  //     subject = `Financing Application Submitted | Ref #${application.application_id} | Newman Tractor`;
  //     fromEmail = "notifications+caroll@newmantractor.com";
  //     fromName = "Caroll Smith";
  //     replyToEmail = "notifications+caroll@newmantractor.com";
  //     bccEmail = "credit@newmantractor.com";
  //     fromFirstName = "Caroll";
  //     fromLastName = "Smith";
  //     fromPhone = "(859) 802-5298";
  //     fromJobTitle = "Credit Manager";
  //     fromImage =
  //       "https://cdn.sanity.io/images/agnoplrn/production/3d170bc7cf16b0fb8f7d9095fbece08f5bba1266-3310x3310.jpg?w=600&h=480&q=75&auto=format&fit=crop";
  //     ctaButtonLink = `${PORTAL_URL}/my-applications`;
  //     ctaButtonText = "VIEW MY APPLICATION";
  //   } else if (activityName === "send to lender") {
  //     //TODO: include notes in email
  //     //TODO: update to new template id
  //     templateId = "d-8f19bf394e2c4c518636551836b346d9";
  //     toEmail = activityMetaData?.lender_email;
  //     subject = `Financing Application Needs Review | Ref #${application.application_id} | Newman Tractor`;
  //     fromEmail = "notifications+matt@newmantractor.com";
  //     fromName = "Matt Salyers";
  //     replyToEmail = "notifications+matt@newmantractor.com";
  //     bccEmail = "finance@newmantractor.com";
  //     fromFirstName = "Matt";
  //     fromLastName = "Salyers";
  //     fromPhone = "(859) 393-5405";
  //     fromJobTitle = "Finance Manager";
  //     fromImage =
  //       "https://cdn.sanity.io/images/agnoplrn/production/73629f66aaedcf2e9cd482f077520d6af2fe5bc2-3522x3522.jpg?w=600&h=480&q=75&auto=format&fit=crop";
  //     ctaButtonLink = `${PORTAL_URL}/my-applications`;
  //     ctaButtonText = "VIEW MY APPLICATION";
  //   } else if (activityName === "sent to lender") {
  //     //TODO: include notes in email
  //     templateId = "d-8f19bf394e2c4c518636551836b346d9";
  //     toEmail = contactEmail;
  //     subject = `Financing Application Under Lender Review | Ref #${application.application_id} | Newman Tractor`;
  //     fromEmail = "notifications+matt@newmantractor.com";
  //     fromName = "Matt Salyers";
  //     replyToEmail = "notifications+matt@newmantractor.com";
  //     bccEmail = "finance@newmantractor.com";
  //     fromFirstName = "Matt";
  //     fromLastName = "Salyers";
  //     fromPhone = "(859) 393-5405";
  //     fromJobTitle = "Finance Manager";
  //     fromImage =
  //       "https://cdn.sanity.io/images/agnoplrn/production/73629f66aaedcf2e9cd482f077520d6af2fe5bc2-3522x3522.jpg?w=600&h=480&q=75&auto=format&fit=crop";
  //     ctaButtonLink = `${PORTAL_URL}/my-applications`;
  //     ctaButtonText = "VIEW MY APPLICATION";
  //   }
  // };

  // await setVariables();

  const msg = {
    to: toEmail,
    from: {
      email: "notifications@newmantractor.com" || SENDGRID_FROM_EMAIL,
      name: `${fromFirstName} ${fromLastName}` || SENDGRID_FROM_NAME,
    },
    replyTo: fromEmail || SENDGRID_FROM_EMAIL,
    // TODO: uncomment when ready for prod
    // bcc: [bccEmail],
    subject: subjectEval,
    templateId: templateId,
    dynamic_template_data: {
      email: toEmail,
      firstName: toFirstName,
      lastName: toLastName,
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
      ctaButtonText: dynamic_content.ctaButtonText,
      ctaButtonLink: eval("`" + dynamic_content.ctaButtonLink + "`"),
      noteText: activityNote,
    },
  };

  console.log("msg:", JSON.stringify(msg));

  await sgMail.send(msg);
};

module.exports = {
  sendFinanceApplicationEmail,
  getFinanceApplicationEmailContent,
};
