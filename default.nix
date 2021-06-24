let 
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/3e94163765975f35f7d8ec509b33c3da52661bd1.tar.gz";
    sha256 = "07sl281r29ygh54dxys1qpjvlvmnh7iv1ppf79fbki96dj9ip7d2";
  };
  holonix = import (holonixPath) {
    includeHolochainBinaries = true;
    holochainVersionId = "custom";

    holochainVersion = { 
     rev = "c5772ba4d67617c4b349aa6a29970b47f4b0e9dc";
     sha256 = "06p9ki2idqmm1nz6a8bfaq9n974pwmww559bpq1gzkg6agn77nyn";
     cargoSha256 = "05c3fvqvypwyi59iknpdx4dri0p3012ax56lrifcnhfflyc5109w";
     bins = {
       holochain = "holochain";
       hc = "hc";
       lair-keystore = "lair-keystore";
     };
    };
  };
in holonix.main