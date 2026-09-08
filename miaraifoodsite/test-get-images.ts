import { getProjectImages } from './src/app/actions/getProjectImages';

async function test() {
  const images = await getProjectImages('pdv-caixa', 'PDV e Caixa');
  console.log(images);
}
test();
