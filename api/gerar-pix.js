export default async function handler(req, res) {
    // Cabeçalhos para evitar erros de conexão (CORS)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    // AQUI ELE VAI BUSCAR A CHAVE QUE VAMOS COLOCAR NA VERCEL
    const token = process.env.PAGBANK_TOKEN; 

    if (!token) {
        console.error("Erro: Token PAGBANK_TOKEN não encontrado na Vercel");
        return res.status(500).json({ error: 'Configuração de servidor pendente (Token).' });
    }

    const { valor, nome, cpf } = req.body;

    // O PagBank EXIGE CPF válido. Se não tiver, dá erro.
    if (!cpf) {
        return res.status(400).json({ error: 'CPF é obrigatório para Pix no PagBank.' });
    }

    try {
        // Estrutura do Pedido para o PagBank
        const pedido = {
            reference_id: "PEDIDO-" + Date.now(),
            customer: {
                name: nome || "Cliente",
                email: "cliente@loja.com", // Email genérico (obrigatório na API)
                tax_id: cpf.replace(/\D/g, ''), // Garante que vai só números
            },
            items: [
                {
                    name: "Salgados Tia Ana",
                    quantity: 1,
                    unit_amount: Math.round(valor * 100) // Converte R$ 10,00 para 1000 centavos
                }
            ],
            qr_codes: [
                {
                    amount: {
                        value: Math.round(valor * 100)
                    },
                    expiration_date: new Date(Date.now() + 3600 * 1000).toISOString() // Expira em 1 hora
                }
            ]
        };

        // Chama o PagBank
        const response = await fetch("https://api.pagseguro.com/orders", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "accept": "application/json"
            },
            body: JSON.stringify(pedido)
        });

        const data = await response.json();

        // Verifica se gerou o QR Code
        if (data.qr_codes && data.qr_codes.length > 0) {
            const pix = data.qr_codes[0];
            
            // Tenta achar o link da imagem do QR Code que o PagBank devolve
            let imagemQr = null;
            if (pix.links) {
                const linkEncontrado = pix.links.find(l => l.rel === "QRCODE.PNG");
                if (linkEncontrado) imagemQr = linkEncontrado.href;
            }

            return res.status(200).json({
                id: data.id,
                qr_code: pix.text, // O código "Copia e Cola"
                qr_code_base64_url: imagemQr // O link da imagem
            });
        } else {
            console.error("Erro PagBank:", JSON.stringify(data));
            return res.status(400).json({ error: "O PagBank recusou o pedido. Verifique o CPF.", detalhe: data });
        }

    } catch (error) {
        console.error("Erro interno:", error);
        return res.status(500).json({ error: error.message });
    }
}