import Link from 'next/link';

const modules = [
  ['Kerf', 'Read legislation and compare versions.'],
  ['Taper', 'Find the authority or court responsible for a matter.'],
  ['Chamfer', 'Prepare a letter to a German authority.'],
  ['Lathe', 'Complete the German legal aid declaration.'],
];

export default function ToolsPage() {
  return <section className="tools-index"><h1>SNTIQ Tools</h1><ul id="projects">
    {modules.map(([name, purpose]) => <li key={name}>
      <Link href={'/dt/' + name.toLowerCase()}>{name}</Link><p>{purpose}</p>
    </li>)}
  </ul></section>;
}
