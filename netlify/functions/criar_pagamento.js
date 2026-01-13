const { MercadoPagoConfig, Preference } = require('mercadopago');

exports.handler = async function(event, context) {
  // Pega a senha que você salvou no site do Netlify
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  const preference = new Preference(client);

  try {
    const dados = JSON.parse(event.body);

    const result = await preference.create({
      body: {
        items: dados.items,
        back_urls: {
          success: "https://salgadosdatia.netlify.app/",
          failure: "https://salgadosdatia.netlify.app/",
          pending: "https://salgadosdatia.netlify.app/"
        },
        auto_return: "approved",
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: result.id })
    };

  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};