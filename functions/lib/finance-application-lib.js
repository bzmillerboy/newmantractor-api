const { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME } =
  process.env;
const sgMail = require("@sendgrid/mail");

const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = "https://vfihmsdvctcwwbtxrhfl.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const createFinanceApplication = async (data) => {
  const { referring_url } = data;
  const { id: userId } = data.user;
  const applicationsRes = await supabase
    .from("applications")
    .insert({
      contact_customer: userId,
      status: 1,
      referring_url: referring_url,
    })
    .select()
    .single();

  if (applicationsRes.error) {
    console.log("create applications error", applicationsRes.error);
  }

  if (applicationsRes.data) {
    return applicationsRes.data;
  }
};

const sendFinanceApplicationEmail = async (data) => {
  sgMail.setApiKey(SENDGRID_API_KEY);
  const { user, application } = data;
  const { action_link, hashed_token, redirect_to } = user.properties;
  const { id, email } = user.user;
  const { first_name, last_name, phone } = user.user.user_metadata;
  const { id: applicationId } = application;

  const link = `${supabaseUrl}/auth/v1/verify?token=${hashed_token}&type=signup&redirect_to=https://portal.newmantractor.com/applications/create/${applicationId}`;

  const msg = {
    to: email,
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: SENDGRID_FROM_NAME,
    },
    bcc: ["bzmiller82@gmail.com"],
    subject: "Financing Application | Newman Tractor",
    templateId: "d-872664c1622349a081ab390bdffbfce3",
    dynamic_template_data: {
      email: email,
      link: link,
      firstName: first_name,
      lastName: last_name,
    },
  };

  const sgMailRes = await sgMail.send(msg);
  return "email sent";
};

module.exports = {
  createFinanceApplication,
  sendFinanceApplicationEmail,
};
