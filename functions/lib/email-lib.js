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

const generateAuthLink = async (email, firstName, lastName) => {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "signup",
    email: email.toLowerCase(),
    options: {
      password: "password",
      redirectTo: `${PORTAL_URL}/home`,
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (error) {
    console.log("generateLink error: ", error);
    return {
      statusCode: error.status || 500,
      headers: {
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify(error.message),
    };
  }

  console.log("generateLink data: ", data);

  return data.properties.action_link;
};

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
  const { id: appId, contact, type, application_id, company } = application;
  const { first_name, last_name, email: contactEmail } = contact;
  const { id: typeId, name: typeName, primary_contact } = type;
  const primaryContactEmail = primary_contact?.email;
  const primaryContactFirstName = primary_contact?.first_name;
  const primaryContactLastName = primary_contact?.last_name;
  const companyName = company?.business_dba || company?.business_name || "";

  let emailNotificationId = "";
  let toEmail = "";
  let toFirstName = "";
  let toLastName = "";
  let ctaButtonLinkAuth = "";
  let contactName = "";
  switch (activityName) {
    case "application submitted":
      if (typeId === 1) {
        emailNotificationId = 1;
        toEmail = contactEmail;
        toFirstName = first_name;
        toLastName = last_name;
      } else if (typeId === 2) {
        emailNotificationId = 2;
        toEmail = contactEmail;
        toFirstName = first_name;
        toLastName = last_name;
      }
      break;
    case "send to lender":
      emailNotificationId = 4;
      toEmail = activityMetaData?.lender_email;
      toFirstName = activityMetaData?.lender_first_name;
      toLastName = activityMetaData?.lender_last_name;
      break;
    case "sent to lender":
      emailNotificationId = 3;
      toEmail = contactEmail;
      toFirstName = first_name;
      toLastName = last_name;
      break;
    case "signatures requested":
      emailNotificationId = 10;
      // TODO: update to be the guarantor's email not the contact's email
      toEmail = activityMetaData?.guarantor_email;
      toFirstName = activityMetaData?.guarantor_first_name;
      toLastName = activityMetaData?.guarantor_last_name;
      ctaButtonLinkAuth = await generateAuthLink(
        activityMetaData?.guarantor_email,
        activityMetaData?.guarantor_first_name,
        activityMetaData?.guarantor_last_name
      );
      break;
    case "lender approved":
    case "finance manager approved":
    case "approved":
      emailNotificationId = 5;
      toEmail = contactEmail;
      toFirstName = first_name;
      toLastName = last_name;
      break;
    case "lender denied":
    case "finance manager denied":
    case "denied":
      emailNotificationId = 6;
      toEmail = contactEmail;
      toFirstName = first_name;
      toLastName = last_name;
      break;
    case "sales rep assigned":
      emailNotificationId = 7;
      toEmail = application.sales_rep.email;
      toFirstName = application.sales_rep.first_name;
      toLastName = application.sales_rep.last_name;
      break;
    case "rental rep assigned":
      emailNotificationId = 7;
      toEmail = application.rental_rep.email;
      toFirstName = application.rental_rep.first_name;
      toLastName = application.rental_rep.last_name;
      break;
    case "credit manager approved":
    case "approved":
      emailNotificationId = 8;
      toEmail = contactEmail;
      toFirstName = first_name;
      toLastName = last_name;
      break;
    case "credit manager denied":
    case "denied":
      emailNotificationId = 9;
      toEmail = contactEmail;
      toFirstName = first_name;
      toLastName = last_name;
      break;
    case "document added":
      emailNotificationId = 11;
      toEmail = primaryContactEmail;
      toFirstName = primaryContactFirstName;
      toLastName = primaryContactLastName;
      contactName = `${first_name} ${last_name}`;
      break;
    default:
      throw new Error("No email notification found for this activity");
  }

  const emailNotification = await getFinanceApplicationEmailContent(
    emailNotificationId
  );

  const defaultFromContact = {
    first_name: SENDGRID_FROM_NAME,
    last_name: "",
    email: SENDGRID_FROM_EMAIL,
    phone: "",
    metadata: {
      emailSignatureJobTitle: "",
      emailSignatureProfilePicture: "",
    },
  };

  const {
    from_contact = defaultFromContact,
    template_id: templateId,
    subject,
    bcc,
    dynamic_content,
  } = emailNotification;

  console.log("emailNotification:", JSON.stringify(emailNotification));

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

  const msg = {
    to: toEmail,
    from: {
      email: "notifications@newmantractor.com" || SENDGRID_FROM_EMAIL,
      name: `${fromFirstName} ${fromLastName}` || SENDGRID_FROM_NAME,
    },
    replyTo: fromEmail || SENDGRID_FROM_EMAIL,
    bcc: bcc,
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
      ctaButtonText: dynamic_content?.ctaButtonText || "",
      ctaButtonLink: dynamic_content?.ctaButtonLink
        ? eval("`" + dynamic_content?.ctaButtonLink + "`")
        : "",
      ctaButtonLinkAuth: ctaButtonLinkAuth,
      noteText: activityNote,
      contactName: contactName,
      companyName: companyName,
      fileName: activityMetaData?.fileName || "",
      primaryContactFirstName: primaryContactFirstName || "",
      primaryContactLastName: primaryContactLastName || "",
      applicationType: typeName || "",
    },
  };

  console.log("msg:", JSON.stringify(msg));

  await sgMail.send(msg);
};

module.exports = {
  sendFinanceApplicationEmail,
  getFinanceApplicationEmailContent,
};
