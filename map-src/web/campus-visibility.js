// r149 does not frustum-cull individual instances. Pack only conservative,
// visible spheres into the existing buffers; geometry and draw batches stay shared.
export function createInstanceVisibility(T,meshes){
  const matrix=new T.Matrix4(),projection=new T.Matrix4(),frustum=new T.Frustum();
  let enabled=false,highlight=null,disposed=false;
  const records=meshes.filter(m=>m.isInstancedMesh).map(mesh=>{
    mesh.geometry.computeBoundingSphere();
    const source=mesh.instanceMatrix.array.slice(),colors=mesh.instanceColor.array.slice(),keys=[...mesh.userData.keys];
    const bounds=keys.map((_,i)=>{matrix.fromArray(source,i*16);const sphere=mesh.geometry.boundingSphere.clone().applyMatrix4(matrix);sphere.radius+=1.25;return sphere;});
    return {mesh,source,colors,keys,bounds,indices:keys.map((_,i)=>i),next:[]};
  });
  function paint(r){
    for(let i=0;i<r.indices.length;i++){
      const index=r.indices[i],active=highlight!==null&&r.keys[index]===highlight;
      for(let c=0;c<3;c++)r.mesh.instanceColor.array[i*3+c]=r.colors[index*3+c]*(active?[1,.86,.62][c]:1);
    }
    r.mesh.instanceColor.needsUpdate=true;
  }
  function pack(r,indices){
    const changed=indices.length!==r.indices.length||indices.some((v,i)=>v!==r.indices[i]);
    if(changed){
      r.indices=[...indices];
      for(let i=0;i<indices.length;i++)r.mesh.instanceMatrix.array.set(r.source.subarray(indices[i]*16,indices[i]*16+16),i*16);
      r.mesh.instanceMatrix.needsUpdate=true;r.mesh.userData.keys=indices.map(i=>r.keys[i]);r.mesh.count=indices.length;paint(r);
    }
    r.mesh.visible=!r.mesh.userData.detailHidden&&r.mesh.count>0;
  }
  return {
    update(camera,active){
      if(disposed)return 0;
      if(!active){if(enabled)for(const r of records)pack(r,r.keys.map((_,i)=>i));enabled=false;return records.reduce((n,r)=>n+r.mesh.count,0);}
      enabled=true;projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
      let count=0;
      for(const r of records){r.next.length=0;for(let i=0;i<r.bounds.length;i++)if(frustum.intersectsSphere(r.bounds[i]))r.next.push(i);pack(r,r.next);count+=r.mesh.visible?r.mesh.count:0;}
      return count;
    },
    highlight(key){if(disposed||key===highlight)return;highlight=key;for(const r of records)paint(r);},
    dispose(){disposed=true;records.length=0;},
  };
}
