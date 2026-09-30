(() => {
const cfg=window.taskReviewConfig||{};
let activeReview=null;
const token=()=>document.querySelector('input[name="__RequestVerificationToken"]')?.value||'';
const formToken=document.createElement('form'); formToken.innerHTML='<input name="__RequestVerificationToken" type="hidden" value="">'; document.body.appendChild(formToken);
const getToken=()=>document.querySelector('meta[name="csrf-token"]')?.content||'';
function post(url,data){const body=new URLSearchParams(data); return fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','RequestVerificationToken':getToken(),'X-Requested-With':'XMLHttpRequest'},body});}
document.querySelectorAll('.review-card').forEach(card=>card.addEventListener('click',async e=>{
 const action=e.target.closest('[data-action]')?.dataset.action; if(!action)return;
 activeReview=Number(card.dataset.reviewId);
 if(action==='reject'){document.getElementById('rejectReason').value='';bootstrap.Modal.getOrCreateInstance(document.getElementById('rejectReviewModal')).show();return;}
 try{
   const r=await post(cfg.approveUrl,{id:activeReview,__RequestVerificationToken:getToken()}); const j=await r.json();
   if(!r.ok||!j.success)throw new Error(j.message||'Unable to approve review.');
   const d=await (await fetch('/Admin/TaskReviews/Details?id='+activeReview)).json();
   if(!d.success)throw new Error(d.message||'Unable to load payment details.');
   activeReview=d.data;
   const x=d.data;
   document.getElementById('paymentTaskTitle').textContent=x.taskTitle||'Payment Details';
   document.getElementById('paymentUserName').textContent=x.userName||'-';
   document.getElementById('paymentAmount').textContent='₹ '+Number(x.amount||0).toFixed(2);
   document.getElementById('paymentMethod').textContent=x.paymentMethod||'Not set';
   document.getElementById('paymentUpi').textContent=x.upiId||'-';
   document.getElementById('paymentHolder').textContent=x.accountHolderName||'-';
   document.getElementById('paymentBank').textContent=x.bankName||'-';
   document.getElementById('paymentAccount').textContent=x.accountNumber||'-';
   document.getElementById('paymentIfsc').textContent=x.ifscCode||'-';
   bootstrap.Modal.getOrCreateInstance(document.getElementById('paymentReviewModal')).show();
 }catch(err){alert(err.message)}
}));
document.getElementById('confirmReject')?.addEventListener('click',async()=>{
 const reason=document.getElementById('rejectReason').value.trim();
 const err=document.getElementById('rejectError'); if(!reason){err.textContent='Rejection reason is required.';return;}
 const r=await post(cfg.rejectUrl,{id:activeReview,reason,__RequestVerificationToken:getToken()});const j=await r.json();
 if(!r.ok||!j.success){err.textContent=j.message||'Unable to reject task.';return;}
 location.reload();
});
async function settle(payNow){
 const r=await post(cfg.settleUrl,{id:activeReview.reviewId||activeReview, payNow:String(payNow),__RequestVerificationToken:getToken()});const j=await r.json();
 if(!r.ok||!j.success){alert(j.message||'Unable to settle payment.');return;}
 bootstrap.Modal.getOrCreateInstance(document.getElementById('paymentReviewModal')).hide();location.reload();
}
document.getElementById('payNow')?.addEventListener('click',()=>settle(true));
document.getElementById('payLater')?.addEventListener('click',()=>settle(false));
})();