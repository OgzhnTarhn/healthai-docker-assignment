import { fetch } from 'undici';

async function test() {
  console.log('Testing domain filter:');
  try {
    const res = await fetch('http://localhost:5000/api/posts?domain=Cardiology');
    const json = await res.json();
    console.log('Domain test:', json.length, 'posts found');
  } catch(e) { console.error(e) }

  console.log('Testing city filter:');
  try {
    const res = await fetch('http://localhost:5000/api/posts?city=Ankara');
    const json = await res.json();
    console.log('City test:', json.length, 'posts found');
  } catch(e) { console.error(e) }

  console.log('Testing status filter:');
  try {
    const res = await fetch('http://localhost:5000/api/posts?status=active');
    const json = await res.json();
    console.log('Status test:', json.length, 'posts found');
  } catch(e) { console.error(e) }
}

test();
