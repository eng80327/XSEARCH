//http://evolvingweb.ca/solr/reuters/select?wt=json&q=money&facet=true&facet.field=topics&facet.field=organisations&facet.field=exchanges&facet.limit=20&facet.mincount=1&start=0&json.wrf=jQuery110207893310573417693_1378285314982&_=1378285314991
//Based on: https://github.com/evolvingweb/ajax-solr.git

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

        self.queryString = function()
        {
            return '&fq=' + self.category() + ':' + self.label();
        }


    }

    function XFacetDateModel(_title)
    {
        var self = this;

        self.title = ko.observable(_title);
        self.valueList = ko.observableArray();

    }

    function XFacetDateValueModel(_category, _startDate, _endDate, _count, _gap, _index)
    {
        var self = this;

        self.category = ko.observable(_category);
        self.startDate = ko.observable(_startDate);
        self.endDate = ko.observable(_endDate);
        self.count = ko.observable(_count);
        self.gap = ko.observable(_gap);
        self.index = ko.observable(_index);

        self.label = function()
        {
            if(self.index()==1)
            {
                return 'Last ' + self.gap() + ' Days';
            }else{
                var startRange = (self.index()-1)* self.gap();
                var endRange = self.index() * self.gap();
                return startRange + ' -  ' + endRange + ' Days';
            }
        }

        self.display = ko.computed(function(){
            return this.label() + ' (' + this.count() + ')';
        }, this);

        self.displaySelected = ko.computed(function(){
            return this.category() + ' (' + this.label() + ')';
        }, this);

        self.queryString = function()
        {
            return '&fq=' + self.category() + ':[' + self.startDate() + ' TO ' + self.endDate() + ']';
        }


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

        self.searchTerm = ko.observable('money');
        self.selectedFacetList = ko.observableArray();

        self.facetList = ko.observableArray();
        self.facetDateList = ko.observableArray();
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
            self.facetDateList.removeAll();
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
            self.startSearch();;
        }

        self.selectFacet = function(facet)
        {
            if(facet.count()==0)
            {
                return;
            }

            self.selectedFacetList.push(facet);
            self.startSearch();
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

        self.addFacetDate = function(_category, fbFacetDate)
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

            var facetDate = new XFacetDateModel(_category);
            var facetDateValuePrevious = null;
            var gap = opts.searchFacetDateGap;
            var i = 1;

            $.each(fbFacetDate, function(index, data){

                if(index=='gap')
                {
                    return;
                }
                if(index=='end')
                {
                    facetDateValuePrevious.endDate(data) ;
                    return;
                }

                var facetDataValue = new XFacetDateValueModel(_category, index, null, data, gap, i);
                i = i + 1;

                if(facetDateValuePrevious!=null)
                {
                    facetDateValuePrevious.endDate(index);
                }

                facetDate.valueList.push(facetDataValue);
                facetDateValuePrevious = facetDataValue;

            });

            if(facetDate.valueList().length>0)
            {
                self.facetDateList.push(facetDate);
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

            if(opts.searchFacetDateList.length>0)
            {
                $.each(opts.searchFacetDateList, function(index, data){

                    searchUrl = searchUrl + "&facet.date=" + data.field;
                    searchUrl = searchUrl + "&facet.date.start=" + encodeURIComponent(data.startDate);
                    searchUrl = searchUrl + "&facet.date.end=" + encodeURIComponent(data.endDate);
                    searchUrl = searchUrl + "&facet.date.gap=" + encodeURIComponent(data.gap);

                });
            }

            searchUrl = searchUrl + '&facet.limit=' + opts.searchFacetLimit;
            searchUrl = searchUrl + '&facet.mincount=' + opts.searchFacetMinCount;


            if(self.selectedFacetList().length>0)
            {
                $.each(self.selectedFacetList(), function(index, data){

                    searchUrl = searchUrl + data.queryString() ;

                });
            }


            if(startRecord!=null && startRecord!=1)
            {
                searchUrl = searchUrl + '&start=' + startRecord;
            }

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

                $.each(data.facet_counts.facet_dates, function(index, fbFacetDate){

                    self.addFacetDate(index, fbFacetDate);

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
    searchFacetMinCount: 1,
    searchFacetDateGap: 10,
    searchFacetDateList:  [
            {
                field: 'date',
                //startDate: 'NOW/DAY-30DAYS',
                //endDate: 'NOW/DAY+30DAYS',
                //gap: '+5DAY',
                startDate: "1987-02-26T00:00:00.000Z/DAY",
                endDate: "1987-10-20T00:00:00.000Z/DAY+1DAY",
                gap: "+10DAY"
            }
        ]

};

/**
 * For Reference.  Solr Date Facetting.
 * facet.date.start: "NOW/DAY-30DAYS"
 * facet.date.end: "NOW/DAY+30DAYS"
 * facet.date.gap: "+10DAY"
 * facet.date: "date"
 *
 *             {
                field: 'date',
                startDate: 'NOW/DAY-3000DAYS',
                endDate: 'NOW/DAY+30DAYS',
                gap: '+10DAY'
            }
 *
 */


