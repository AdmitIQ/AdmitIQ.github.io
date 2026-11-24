import http from 'node:http';
const cols = [
 { unitid: 140553, inst_name: 'Spelman College', city: 'Atlanta', state_abbr: 'GA', inst_control: 2, url_school: 'www.spelman.edu', inst_level: 1, degree_granting: 1, latitude: 33.74, longitude: -84.41 },
 { unitid: 110422, inst_name: 'California Polytechnic State University-San Luis Obispo', city: 'San Luis Obispo', state_abbr: 'CA', inst_control: 1, url_school: 'www.calpoly.edu', inst_level: 1, degree_granting: 1 },
 { unitid: 999999, inst_name: 'Nondegree Beauty School', city: 'X', state_abbr: 'TX', inst_control: 3, inst_level: 3, degree_granting: 2 },
];
const hs = Array.from({ length: 30 }, (_, i) => ({ ncessch: 60000000000 + i, school_name: i === 0 ? 'Lincoln High School' : `Test High ${i}`, city_location: 'Stockton', charter: i % 5 === 0 ? 1 : 0, enrollment: 1000 + i }));
const tav = { results: [{ title: 'Spelman reviews', url: 'https://www.niche.com/colleges/spelman-college/reviews/', content: 'Students love the sisterhood and alumni network; dorms are old.' }, { title: 'r/ApplyingToCollege', url: 'https://www.reddit.com/r/x/1', content: 'Academics are rigorous, financial aid can be limited.' }] };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('content-type', 'application/json');
  if (u.pathname === '/search') { return res.end(JSON.stringify(tav)); }
  if (u.pathname.includes('/2023/')) { res.statusCode = 404; return res.end('{}'); } // force year fallback
  if (u.pathname.includes('ipeds/directory/2022')) {
    const page = Number(u.searchParams.get('page') || 1);
    return res.end(JSON.stringify(page === 1 ? { results: cols.slice(0, 2), next: `http://127.0.0.1:8899${u.pathname}?page=2` } : { results: cols.slice(2), next: null }));
  }
  if (u.pathname.includes('ccd/directory/2022')) return res.end(JSON.stringify({ results: u.searchParams.get('fips') === '6' ? hs : [], next: null }));
  res.statusCode = 404; res.end('{}');
}).listen(8899, () => console.log('mock urban 8899'));
