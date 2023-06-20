//TODO: make CTA button dynamic based on PORTAL_URL

const {
  HUBSPOT_PORTAL_ID,
  HUBSPOT_PRIVATE_APP_TOKEN,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FINAPP_REPLYTO_EMAIL,
  SENDGRID_FROM_NAME,
  PORTAL_URL,
  SUPABASE_URL,
} = process.env;
const { createClient } = require("@supabase/supabase-js");
const Hubspot = require("hubspot");
const sgMail = require("@sendgrid/mail");
const hubspot = new Hubspot({
  accessToken: HUBSPOT_PRIVATE_APP_TOKEN,
  checkLimit: false,
});
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
  const payload = JSON.parse(event.body);
  // console.log("finapp-notifications payload:", JSON.stringify(payload));
  const appId = payload.record.application_id;
  const activityName = payload.record.name;
  console.log("apiKey:", event.queryStringParameters.apiKey);
  // TODO: check apiky and return 401 if not valid

  sgMail.setApiKey(SENDGRID_API_KEY);

  const { data: application, error: applicationsError } = await supabase
    .from("applications")
    .select(
      "contact:contact_id(email, first_name, last_name), type:type_id(id, name), *"
    )
    .eq("id", appId)
    .single();

  console.log("application:", JSON.stringify(application));

  const { contact, type, application_id } = application;

  const { first_name, last_name, email } = contact;
  const { id: typeId } = type;

  const bccEmail = () => {
    let bccEmail = "";
    const shouldBCC = payload.record.name === "application submitted";
    if (typeId === 1 && shouldBCC) {
      bccEmail = "finance@newmantractor.com";
    } else if (typeId === 2 && shouldBCC) {
      bccEmail = "credit@newmantractor.com";
    }

    return bccEmail, "bzmiller82@gmail.com";
  };
  const subject = `Financing Application Submitted | Ref #${application.application_id} | Newman Tractor`; //TODO: make this more dynamic based on application_activity.name
  const templateId = "d-8e9c9cf1077b4278a413f33c68a7bdca"; //TODO: make this more dynamic based on application_activity.name

  //TODO: improe these to have a fallback for emails that come from notifications@newmantractor.com
  const fromFirstName = typeId === 1 ? "Matt" : "Caroll";
  const fromLastName = typeId === 1 ? "Salyers" : "Smith";
  const fromEmail =
    typeId === 1 ? "matt@newmantractor.com" : "caroll@newmantractor.com";
  const fromPhone = typeId === 1 ? "(859) 393-5405" : "(859) 802-5298";
  const fromJobTitle = typeId === 1 ? "Finance Manager" : "Credit Manager";
  const fromImage =
    typeId === 1
      ? "https://cdn.sanity.io/images/agnoplrn/production/73629f66aaedcf2e9cd482f077520d6af2fe5bc2-3522x3522.jpg?w=600&h=480&q=75&auto=format&fit=crop"
      : "https://cdn.sanity.io/images/agnoplrn/production/3d170bc7cf16b0fb8f7d9095fbece08f5bba1266-3310x3310.jpg?w=600&h=480&q=75&auto=format&fit=crop";

  const ctaLink = `${PORTAL_URL}/my-applications`;
  const msg = {
    to: email,
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: SENDGRID_FROM_NAME,
    },
    replyTo: SENDGRID_FINAPP_REPLYTO_EMAIL,
    bcc: [bccEmail()],
    subject: subject,
    templateId: templateId,
    dynamic_template_data: {
      email: email,
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
      ctaLink: ctaLink,
    },
  };

  console.log("msg:", JSON.stringify(msg));

  try {
    await sgMail.send(msg);
    return { statusCode: 200 };
  } catch (e) {
    console.error(e);
    return {
      statusCode: e.statusCode,
      body: `${e.message} - ${JSON.stringify(e.response.body.errors)}`,
    };
  }
};
