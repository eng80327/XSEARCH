//http://evolvingweb.ca/solr/reuters/select?wt=json&q=money&facet=true&facet.field=topics&facet.field=organisations&facet.field=exchanges&facet.limit=20&facet.mincount=1&start=0&json.wrf=jQuery110207893310573417693_1378285314982&_=1378285314991

function SolrSearch($, ko, settings){

    //1.   Variables and Methods
    var self = this;
    var viewModel = null;
    var opts = $.extend({}, SolrSearch.DefaultSettings, settings);

    //2.  KO Objects
    function XFacetModel(_title)
    {
        var self = this;

        self.title = ko.observable(_title);
        self.valueList = ko.observableArray();
        self.selectedValue = null;

    }

    function XFacetValueModel(_category, _label, _count, _queryStringParam)
    {
        var self = this;

        self.category = ko.observable(_category);
        self.label = ko.observable(_label);
        self.count = ko.observable(_count);
        self.queryStringParam = ko.observable(_queryStringParam);

        self.display = ko.computed(function(){
            return this.label() + ' (' + this.count() + ')';
        }, this);

        self.displaySelected = ko.computed(function(){
            return this.category() + ' (' + this.label() + ')';
        }, this);

    }

    function XResultSummaryModel(_totalMatching, _currStart, _currEnd, _query)
    {
        var self = this;

        self.totalMatching = ko.observable(_totalMatching);
        self.currStart = ko.observable(_currStart);
        self.currEnd = ko.observable(_currEnd);
        self.query = ko.observable(_query);

    }

    function XResultModel(_title, _summary, _url)
    {
        var self = this;

        self.title = ko.observable(_title);
        self.summary = ko.observable(_summary);
        self.url = ko.observable(_url);

    }

    function XPageModel(_pageNo, _pageSize, _currentPageFlag)
    {
        var self = this;

        self.pageNo =  _pageNo;
        self.pageSize = _pageSize;
        self.startRecord = (self.pageNo-1)*self.pageSize + 1;
        self.currentPageFlag = _currentPageFlag;

        self.pageStatus =  ko.computed(function() {
            return self.currentPageFlag  ? "currentPage" : "otherPage";
        }, this);

    }

    //3.  View Model
    function XSearchViewModel()
    {
        var self = this;

        self.searchTerm = ko.observable('the');
        self.selectedFacetList = ko.observableArray();

        self.facetList = ko.observableArray();
        self.resultSummary = new XResultSummaryModel();
        self.resultList = ko.observableArray();
        self.pageList = ko.observableArray();
        self.showPagePrevious = ko.observable(false);
        self.showPageNext = ko.observable(false);

        self.searchSummary = ko.computed(function(){

            if(this.resultSummary.currStart()==null)
            {
                return "";
            }

            if(this.resultSummary.totalMatching()==0)
            {
                return 'No results found.  Try again!'
            }else{
                return this.resultSummary.currStart() + '-' + this.resultSummary.currEnd() + ' of ' +  this.resultSummary.totalMatching() + ' search results for <b>' + this.searchTerm() + '</b>';
            }

        }, this);

        self.clear = function()
        {
            self.facetList.removeAll();
            self.resultList.removeAll();
            self.pageList.removeAll();
        }

        self.processPageList = function()
        {
            var noPagesDisplay = opts.noPagesDisplay;
            var noPagesDisplayBeforeCurrent = opts.noPagesDisplayBeforeCurrent;
            var pageSize = opts.pageSize;

            var currStart = self.resultSummary.currStart();
            var currEnd = currStart + pageSize;
            var totalMatching = self.resultSummary.totalMatching();

            self.resultSummary.currEnd(currEnd);

            var currentPage = (currStart-1)/pageSize + 1;
            var totalPages = Math.floor(totalMatching/pageSize);
            if(totalMatching%pageSize!=0)
            {
                totalPages = totalPages + 1;
            }

            for(var i=4; i>0; i--)
            {
                if(currentPage-i>0){
                    self.pageList.push(new XPageModel(currentPage-i, pageSize, false));
                }
            }

            var noPagesDisplayAfterCurrent = noPagesDisplay - 1 - self.pageList().length;

            self.pageList.push(new XPageModel(currentPage, pageSize, true));

            for(var i=1; i<=noPagesDisplayAfterCurrent; i++)
            {
                if(currentPage+i <= totalPages){
                    self.pageList.push(new XPageModel(currentPage+i, pageSize, false));
                }
            }

            if(currentPage>1)
            {
                self.showPagePrevious(true);
            }else{
                self.showPagePrevious(false);
            }
            if(currentPage<totalPages)
            {
                self.showPageNext(true);
            }else{
                self.showPageNext(false);
            }

        }

        self.goToPage = function(page)
        {
            if(page.currentPageFlag)
            {
                return;
            }
            self.search(page.startRecord);
        }
        self.goToPagePrevious = function()
        {
            var pageSize = opts.pageSize;
            var currStart = self.resultSummary.currStart();

            self.search(currStart - opts.pageSize );
        }
        self.goToPageNext = function()
        {
            var pageSize = opts.pageSize;
            var currStart = self.resultSummary.currStart();

            self.search(currStart + opts.pageSize );
        }

        self.unselectFacet = function(facet)
        {
            self.selectedFacetList.remove(facet);
            self.search();
        }

        self.selectFacet = function(facet)
        {
            self.selectedFacetList.push(facet);
            self.search();
        }

        self.addFacet = function(_category, fbFacet)
        {

            var selectedItem = ko.utils.arrayFilter(self.selectedFacetList(), function(item){
                if(item.category() == _category){
                    return true;
                }
                return false;
            });
            if(selectedItem.length!=0){
                return;
            }

            var facet = new XFacetModel(_category);

            for(var i=0; i<fbFacet.length; i=i+2)
            {
                facet.valueList.push(new XFacetValueModel(_category, fbFacet[i], fbFacet[i+1], null));
            }

            if(facet.valueList().length>0)
            {
                self.facetList.push(facet);
            }

        }


        self.startSearch = function()
        {
            self.search(1);
        }

        self.search = function(startRecord){

            var startRecord = startRecord - 1;  //Solr starts from 0

            var searchUrl = opts.searchUrl + '?wt=json'
            if(self.searchTerm()!='')
            {
                searchUrl = searchUrl + '&q=' + self.searchTerm();
            }

            if(opts.searchFacetList.length > 0)
            {
                searchUrl = searchUrl + '&facet=true';

                $.each(opts.searchFacetList, function(index, data){

                    searchUrl = searchUrl + '&facet.field=' + data;

                });
            }

            searchUrl = searchUrl + '&facet.limit=' + opts.searchFacetLimit;
            searchUrl = searchUrl + '&facet.mincount=' + opts.searchFacetMinCount;


            if(self.selectedFacetList().length>0)
            {
                $.each(self.selectedFacetList(), function(index, data){

                    searchUrl = searchUrl + '&fq=' + data.category() + ':' + data.label() ;

                });
            }


            if(startRecord!=null && startRecord!=1)
            {
                searchUrl = searchUrl + '&start=' + startRecord;
            }

            /**
            searchUrl = 'http://evolvingweb.ca/solr/reuters/select?wt=json&facet=true&q=*%3A*&facet.field=topics&facet.field=organisations&facet.field=exchanges&' +
                'facet.field=countryCodes' +
                '&facet.limit=20&facet.mincount=1&f.topics.facet.limit=50&f.countryCodes.facet.limit=-1&facet.date=date&facet.date.start=1987-02-26T00%3A00%3A00.000Z%2FDAY&facet.date.end=1987-10-20T00%3A00%3A00.000Z%2FDAY%2B1DAY&facet.date.gap=%2B1DAY&json.nl=map';
            **/
            $.ajax({
                type: "GET",
                url: searchUrl,
                contentType: "application/json",
                dataType: 'jsonp',
                jsonp: 'json.wrf'
            }).done(function(data){

                    self.processSearch(data);

                })

        };

        self.processSearch = function(data)
        {
            self.clear();

            var totalResults =  data.response.numFound;
            self.resultSummary.totalMatching(totalResults);

            if(totalResults>0){

                $.each(data.facet_counts.facet_fields, function(index, fbFacet){

                    self.addFacet(index, fbFacet);

                });
                $.each(data.response.docs, function(index, result){

                    var result = new XResultModel(result.title, result.text, 'http://google.com');
                    self.resultList.push(result);

                });

                self.resultSummary.currStart(data.response.start + 1);
                self.resultSummary.query(data.responseHeader.params.q);

                self.processPageList();

            }

        }
    }



    //4. Init
    self.init = function(element){

        self.viewModel = new XSearchViewModel();
        var selectedElement = document.getElementById($(element).attr("id"));

        ko.applyBindings(self.viewModel, selectedElement);

    };


}

SolrSearch.DefaultSettings = {
    pageSize: 10,
    noPagesDisplay : 10,
    noPagesDisplayBeforeCurrent : 4,
    searchUrl: "http://evolvingweb.ca/solr/reuters/select",
    searchFacetList: ['topics', 'organisations', 'exchanges'],
    searchFacetLimit: 20,
    searchFacetMinCount: 1

};


