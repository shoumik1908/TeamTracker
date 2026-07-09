

console.log('Sending request...');

axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
    params: {
        grant_type: 'authorization_code',
        client_id: '1000.7E1XNBLW1QSQ0YLQUM4MX9Q7JGLCLA',
        client_secret: '94987337f6f45f0458b3696465534e03c0a2ee828e',
        code: '1000.9849bc55177f0aa7e920f6d5cc118752.878b9fe2eca2e5f796171af3ffcaacc3',
    },
})
    .then(res => {
        console.log('SUCCESS:');
        console.log(res.data);
    })
    .catch(err => {
        console.log('ERROR:');
        console.log(err.response?.data || err.message);
    });