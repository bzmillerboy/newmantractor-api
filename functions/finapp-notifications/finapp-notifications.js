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
  console.log("finapp-notifications payload:", JSON.stringify(payload));
  const appId = payload.record.application_id;
  const activityName = payload.record.name;
  const apiKey = JSON.parse(event.queryStringParameters).apiKey;
  console.log("apiKey:", apiKey);
  // TODO: check apiky and return 401 if not valid

  sgMail.setApiKey(SENDGRID_API_KEY);

  const { data: application, error: applicationsError } = await supabase
    .from("applications")
    .select(
      "contact:contact_id(email, first_name, last_name), type:type_id(id, name) *"
    )
    .eq("id", appId)
    .single();

  console.log("application:", JSON.stringify(application));

  const { contact, type } = payload;

  const { first_name, last_name, email } = contact;
  const { id: typeId } = type;

  const bccEmail = () => {
    let bccEmail = "";
    const shouldBCC = payload.record.name === "application submitted";
    if (applications.type_id === 1 && shouldBCC) {
      bccEmail = "finance@newmantractor.com";
    } else if (applications.type_id === 2 && shouldBCC) {
      bccEmail = "credit@newmantractor.com";
    }

    return bccEmail, "bzmiller82@gmail.com";
  };
  const subject = `Financing Application Submitted | Ref #${application.application_id} | Newman Tractor`; //TODO: make this more dynamic based on application_activity.name
  const templateId = "d-8e9c9cf1077b4278a413f33c68a7bdca"; //TODO: make this more dynamic based on application_activity.name
  const fromImage =
    "https://cdn.sanity.io/images/agnoplrn/production/73629f66aaedcf2e9cd482f077520d6af2fe5bc2-3522x3522.jpg?w=600&h=480&q=75&auto=format&fit=crop"; //TODO: make this more dynamic based on application_activity.name
  const fromPhone = "(859) 393-5405"; // TODO: make this more dynamic based on application_activity.name

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
      type: type,
      applicationId: application.application_id,
      fromImage: fromImage,
      fromPhone: fromPhone,
      fromFirstName: "MattFT",
      fromLastName: "SalyersFT",
      fromPhone: "(859) 393-5405FT",
      fromEmail: "matt@newmantractor.comFT",
      fromJobTitle: "Finance ManagerFT",
      type: typeId,
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
