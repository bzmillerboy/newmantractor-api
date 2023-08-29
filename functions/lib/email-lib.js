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
const lib = require("../lib/lib.js");

const sgMail = require("@sendgrid/mail");

const generateLink = async (email, firstName, lastName, existingUser) => {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: existingUser ? "magiclink" : "signup",
    email: email.toLowerCase(),
    password: "nt" + email.toLowerCase() + firstName + lastName,
    options: {
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

  // console.log("generateLink link: ", data);

  return `${supabaseUrl}/auth/v1/verify?token=${
    data?.properties?.hashed_token
  }&type=${existingUser ? "magiclink" : "signup"}&redirect_to=${PORTAL_URL}`;
};

const generateAuthLink = async (
  email,
  firstName,
  lastName,
  knownExistingUser
) => {
  if (knownExistingUser) {
    // console.log("knownExistingUser", knownExistingUser);
    return generateLink(email, firstName, lastName, true);
  } else {
    // console.log("NO knownExistingUser", knownExistingUser);
    //1. Check if user exists
    const { data: contact, error: userError } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email)
      .single();

    // console.log("does contact exist?", contact);

    //2. Generate link
    return generateLink(email, firstName, lastName, contact || false);
  }
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
  if (emailNotification) {
    const emailNotificationData = {
      templateId: emailNotification?.template_id || "",
      fromFirstName:
        emailNotification?.from_contact?.first_name || SENDGRID_FROM_NAME || "",
      fromLastName: emailNotification?.from_contact?.last_name || "",
      fromEmail:
        emailNotification?.from_contact?.email || SENDGRID_FROM_EMAIL || "",
      fromPhone: emailNotification?.from_contact?.phone || "",
      // subject: eval("`" + emailNotification?.subject + "`"),
      fromJobTitle:
        emailNotification?.from_contact?.metadata?.emailSignatureJobTitle || "",
      fromImage:
        emailNotification?.from_contact?.metadata
          ?.emailSignatureProfilePicture || "",
      ctaButtonText: emailNotification?.dynamic_content?.ctaButtonText || "",
      ctaButtonLink:
        `${emailNotification?.dynamic_content?.ctaButtonLink}` || "",
    };

    return emailNotificationData;
  } else {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error retrieving email notifications data",
      }),
    };
  }
};

const sendFinanceApplicationEmail = async (application, sourceData, toData) => {
  sgMail.setApiKey(SENDGRID_API_KEY);

  console.log("toData:", JSON.stringify(toData));

  const notificationData = await getFinanceApplicationEmailContent(
    toData?.emailNotificationId
  );

  console.log("notificationData:", JSON.stringify(notificationData));

  const appId = sourceData?.appId;

  const msg = {
    to: toData?.toEmail,
    from: {
      email: "notifications@newmantractor.com" || SENDGRID_FROM_EMAIL,
      name:
        `${notificationData?.fromFirstName} ${notificationData?.fromLastName}` ||
        SENDGRID_FROM_NAME,
    },
    replyTo: notificationData?.fromEmail || SENDGRID_FROM_EMAIL,
    bcc: notificationData?.bcc,
    // subject: notificationData?.subject,
    templateId: notificationData?.templateId,
    dynamic_template_data: {
      applicantFirstName: sourceData?.contactFirstName,
      applicantLastName: sourceData?.contactLastName,
      companyName: sourceData?.companyName,
      email: toData?.toEmail,
      firstName: toData?.toFirstName,
      lastName: toData?.toLastName,
      applicationId: sourceData?.applicationId,
      fromImage: notificationData?.fromImage,
      fromPhone: lib.formatPhoneNumber(notificationData?.fromPhone),
      fromFirstName: notificationData?.fromFirstName,
      fromLastName: notificationData?.fromLastName,
      fromEmail: notificationData?.fromEmail,
      fromJobTitle: notificationData?.fromJobTitle,
      typeId: sourceData?.typeId,
      ctaButtonText: notificationData?.ctaButtonText || "",
      ctaButtonLink: notificationData?.ctaButtonLink
        ? `${PORTAL_URL}${eval("`" + notificationData?.ctaButtonLink + "`")}`
        : "",
      ctaButtonLinkAuth:
        toData?.ctaButtonLinkAuth &&
        `${PORTAL_URL}/magic-link-login?confirmationUrl=${encodeURIComponent(
          toData?.ctaButtonLinkAuth +
            eval("`" + notificationData?.ctaButtonLink + "`")
        )}`,
      noteText: sourceData?.activityNote || "",
      contactName: toData?.contactName || "",
      fileName: sourceData?.activityMetaData?.fileName || "",
      primaryContactFirstName: sourceData?.primaryContactFirstName || "",
      primaryContactLastName: sourceData?.primaryContactLastName || "",
      applicationType: sourceData?.typeName || "",
      lenderCompanyName:
        sourceData?.activityMetaData?.lender_company_name || "",
      lenderName:
        `${sourceData?.activityMetaData?.lender_first_name} ${sourceData?.activityMetaData?.lender_last_name}` ||
        "",
    },
  };

  console.log("msg:", JSON.stringify(msg));

  // await sgMail.send(msg);

  return;
};

const compileFinanceApplicationEmail = async (activityRecord, application) => {
  let sourceData = {
    activityMetaData: activityRecord.metadata,
    activityName: activityRecord.name,
    activityNote: activityRecord.note_text,
    appId: application?.id,
    applicationId: application?.application_id,
    contactFirstName: application?.contact?.first_name,
    contactLastName: application?.contact?.last_name,
    contactEmail: application?.contact?.email,
    typeId: application?.type?.id,
    typeName: application?.type?.name,
    primaryContactEmail: application?.type?.primary_contact?.email,
    primaryContactFirstName: application?.type?.primary_contact?.first_name,
    primaryContactLastName: application?.type?.primary_contact?.last_name,
    companyName:
      application?.company?.business_dba ||
      application?.company?.business_name ||
      "",
  };
  // console.log("sourceData:", JSON.stringify(sourceData));

  let toDataCustomer = {};
  let toDataRep = {};
  let toDataRentalRep = {};
  let toDataManager = {};
  let toDataLender = {};
  switch (sourceData.activityName) {
    case "application submitted":
      // send to customer
      toDataCustomer = {
        // when app submitted, if credit send from Credit Manager, if finance send from Finance Manager
        emailNotificationId: sourceData?.typeId === 1 ? 1 : 2,
        toEmail: sourceData?.contactEmail,
        toFirstName: sourceData?.contactFirstName,
        toLastName: sourceData?.contactLastName,
        ctaButtonLinkAuth: await generateAuthLink(sourceData?.contactEmail),
      };
      await sendFinanceApplicationEmail(
        application,
        sourceData,
        toDataCustomer
      );
      // send to finance/credit manager
      toDataManager = {
        emailNotificationId: 13,
        toEmail: sourceData?.primaryContactEmail,
        toFirstName: sourceData?.primaryContactFirstName,
        toLastName: sourceData?.primaryContactLastName,
      };
      await sendFinanceApplicationEmail(application, sourceData, toDataManager);
      break;
    case "sales rep assigned":
      // Send to sales rep
      toDataRep = {
        emailNotificationId: 7,
        toEmail: application.sales_rep.email,
        ctaButtonLinkAuth: await generateAuthLink(
          sourceData?.application.sales_rep.email
        ),
      };
      await sendFinanceApplicationEmail(application, sourceData, toDataRep);
      break;
    case "rental rep assigned":
      // Send to rental rep
      toDataRentalRep = {
        emailNotificationId: 7,
        toEmail: application.rental_rep.email,
        toFirstName: application.rental_rep.first_name,
        toLastName: application.rental_rep.last_name,
        ctaButtonLinkAuth: await generateAuthLink(application.rental_rep.email),
      };
      await sendFinanceApplicationEmail(
        application,
        sourceData,
        toDataRentalRep
      );
      break;
    case "lender approved":
    case "finance manager approved":
    case "approved":
      // Send to customer
      toDataCustomer = {
        emailNotificationId: 5,
        toEmail: sourceData?.contactEmail,
        toFirstName: sourceData?.contactFirstName,
        toLastName: sourceData?.contactLastName,
        ctaButtonLinkAuth: await generateAuthLink(sourceData?.contactEmail),
      };
      await sendFinanceApplicationEmail(
        application,
        sourceData,
        toDataCustomer
      );
      // Send to sales rep
      toDataRep = {
        emailNotificationId: 12,
        toEmail: application.sales_rep.email,
        toFirstName: application.sales_rep.first_name,
        toLastName: application.sales_rep.last_name,
        ctaButtonLinkAuth: await generateAuthLink(
          sourceData?.application.sales_rep.email
        ),
      };
      await sendFinanceApplicationEmail(application, sourceData, toDataRep);
      // Send to rental rep
      toDataRentalRep = {
        emailNotificationId: 12,
        toEmail: application.rental_rep.email,
        toFirstName: application.rental_rep.first_name,
        toLastName: application.rental_rep.last_name,
        ctaButtonLinkAuth: await generateAuthLink(application.rental_rep.email),
      };
      await sendFinanceApplicationEmail(
        application,
        sourceData,
        toDataRentalRep
      );
      if (sourceData.activityName !== "finance manager approved") {
        // Send to finance manager
        toDataManager = {
          emailNotificationId: 12,
          toEmail: sourceData?.primaryContactEmail,
          toFirstName: sourceData?.primaryContactFirstName,
          toLastName: sourceData?.primaryContactLastName,
        };
        await sendFinanceApplicationEmail(
          application,
          sourceData,
          toDataManager
        );
      }
      break;
    case "lender denied":
    case "finance manager denied":
    case "denied":
      // Send to customer
      toDataCustomer = {
        emailNotificationId: 6,
        toEmail: sourceData?.contactEmail,
        toFirstName: sourceData?.contactFirstName,
        toLastName: sourceData?.contactLastName,
        ctaButtonLinkAuth: await generateAuthLink(sourceData?.contactEmail),
      };
      await sendFinanceApplicationEmail(
        application,
        sourceData,
        toDataCustomer
      );
      // Send to sales rep
      toDataRep = {
        emailNotificationId: 14,
        toEmail: application.sales_rep.email,
        toFirstName: application.sales_rep.first_name,
        toLastName: application.sales_rep.last_name,
        ctaButtonLinkAuth: await generateAuthLink(
          sourceData?.application.sales_rep.email
        ),
      };
      await sendFinanceApplicationEmail(application, sourceData, toDataRep);
      // Send to rental rep
      toDataRentalRep = {
        emailNotificationId: 12,
        toEmail: application.rental_rep.email,
        toFirstName: application.rental_rep.first_name,
        toLastName: application.rental_rep.last_name,
        ctaButtonLinkAuth: await generateAuthLink(application.rental_rep.email),
      };
      await sendFinanceApplicationEmail(
        application,
        sourceData,
        toDataRentalRep
      );
      if (sourceData.activityName !== "finance manager denied") {
        // Send to finance manager
        toDataManager = {
          emailNotificationId: 14,
          toEmail: sourceData?.primaryContactEmail,
          toFirstName: sourceData?.primaryContactFirstName,
          toLastName: sourceData?.primaryContactLastName,
        };
        await sendFinanceApplicationEmail(
          application,
          sourceData,
          toDataManager
        );
      }
      break;
    case "credit manager approved":
    case "approved":
      // Send to customer
      toDataCustomer = {
        emailNotificationId: 8,
        toEmail: sourceData?.contactEmail,
        toFirstName: sourceData?.contactFirstName,
        toLastName: sourceData?.contactLastName,
        ctaButtonLinkAuth: await generateAuthLink(sourceData?.contactEmail),
      };
      await sendFinanceApplicationEmail(
        application,
        sourceData,
        toDataCustomer
      );
      // Send to sales rep
      toDataRep = {
        emailNotificationId: 12,
        toEmail: application.sales_rep.email,
        toFirstName: application.sales_rep.first_name,
        toLastName: application.sales_rep.last_name,
        ctaButtonLinkAuth: await generateAuthLink(
          sourceData?.application.sales_rep.email
        ),
      };
      await sendFinanceApplicationEmail(application, sourceData, toDataRep);
      // Only send to rental rep if application type is credit
      if (sourceData.typeId === 2) {
        // Send to rental rep
        toDataRentalRep = {
          emailNotificationId: 12,
          toEmail: application.rental_rep.email,
          toFirstName: application.rental_rep.first_name,
          toLastName: application.rental_rep.last_name,
          ctaButtonLinkAuth: await generateAuthLink(
            application.rental_rep.email
          ),
        };
        await sendFinanceApplicationEmail(
          application,
          sourceData,
          toDataRentalRep
        );
      }
      break;
    case "credit manager denied":
    case "denied":
      // Send to customer
      toDataCustomer = {
        emailNotificationId: 9,
        toEmail: sourceData?.contactEmail,
        toFirstName: sourceData?.contactFirstName,
        toLastName: sourceData?.contactLastName,
        ctaButtonLinkAuth: await generateAuthLink(sourceData?.contactEmail),
      };
      await sendFinanceApplicationEmail(
        application,
        sourceData,
        toDataCustomer
      );
      // Send to sales rep
      toDataRep = {
        emailNotificationId: 14,
        toEmail: application.sales_rep.email,
        toFirstName: application.sales_rep.first_name,
        toLastName: application.sales_rep.last_name,
        ctaButtonLinkAuth: await generateAuthLink(
          sourceData?.application.sales_rep.email
        ),
      };
      await sendFinanceApplicationEmail(application, sourceData, toDataRep);
      // Only send to rental rep if application type is credit
      if (sourceData.typeId === 2) {
        // Send to rental rep
        toDataRentalRep = {
          emailNotificationId: 14,
          toEmail: application.rental_rep.email,
          toFirstName: application.rental_rep.first_name,
          toLastName: application.rental_rep.last_name,
          ctaButtonLinkAuth: await generateAuthLink(
            application.rental_rep.email
          ),
        };
        await sendFinanceApplicationEmail(
          application,
          sourceData,
          toDataRentalRep
        );
      }
      break;
    case "send to lender":
      // Send to lender
      toDataLender = {
        emailNotificationId: 4,
        toEmail: sourceData?.activityMetaData?.lender_email,
        toFirstName: sourceData?.activityMetaData?.lender_first_name,
        toLastName: sourceData?.activityMetaData?.lender_last_name,
        ctaButtonLinkAuth: await generateAuthLink(
          sourceData?.activityMetaData?.lender_email,
          sourceData?.activityMetaData?.lender_first_name,
          sourceData?.activityMetaData?.lender_last_name
        ),
      };
      await sendFinanceApplicationEmail(application, sourceData, toDataLender);
      // Send to customer
      toDataCustomer = {
        emailNotificationId: 3,
        toEmail: sourceData?.contactEmail,
        toFirstName: sourceData?.contactFirstName,
        toLastName: sourceData?.contactLastName,
        ctaButtonLinkAuth: await generateAuthLink(sourceData?.contactEmail),
      };
      await sendFinanceApplicationEmail(
        application,
        sourceData,
        toDataCustomer
      );
      break;
    case "signatures requested":
      // Send to signer customer
      toDataCustomer = {
        emailNotificationId: 10,
        toEmail: sourceData?.activityMetaData?.guarantor_email,
        toFirstName: sourceData?.activityMetaData?.guarantor_first_name,
        toLastName: sourceData?.activityMetaData?.guarantor_last_name,
        ctaButtonLinkAuth: await generateAuthLink(
          sourceData?.activityMetaData?.guarantor_email,
          sourceData?.activityMetaData?.guarantor_first_name,
          sourceData?.activityMetaData?.guarantor_last_name
        ),
      };
      await sendFinanceApplicationEmail(
        application,
        sourceData,
        toDataCustomer
      );
      break;
    case "document added":
      // Send to finance/credit manager
      toDataManager = {
        emailNotificationId: 11,
        toEmail: primaryContactEmail,
        toFirstName: primaryContactFirstName,
        toLastName: primaryContactLastName,
      };
      await sendFinanceApplicationEmail(application, sourceData, toDataManager);
      break;
    default:
      throw new Error("No email notification found for this activity");
  }
};

module.exports = {
  compileFinanceApplicationEmail,
  getFinanceApplicationEmailContent,
};
