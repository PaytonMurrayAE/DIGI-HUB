// ADVANCED / UNTESTED OUTSIDE CLAUDE: restores records from a backup bundle into the live Hub database.
// The supported way to restore is to ask Claude (see the Technical Handoff, section 9).
//
// To use this yourself: open the Hub, open the browser's developer tools, switch the console's JavaScript context to the
// page's inner frame (the Hub runs inside a frame), paste the bundle JSON into BUNDLE below, then run this.
// It only writes records; it never deletes. Records that already exist are overwritten with the backup version.
(async function(){
  const BUNDLE = {/* paste the contents of data-backup/hub/_bundle.json here */};
  const db = await claude.use('db');
  if(!db){ console.error('No database in this frame. Switch the console to the Hub\'s inner frame.'); return; }
  let n = 0;
  for(const coll of Object.keys(BUNDLE)){
    for(const id of Object.keys(BUNDLE[coll])){
      await db.collection(coll).doc(id).set(BUNDLE[coll][id]);
      n++;
    }
  }
  console.log('Restored', n, 'records.');
})();
